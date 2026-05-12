// 전역 선택 날짜 컨텍스트
// - 값 형식: YYYY-MM-DD 문자열
// - 기본값: attendance_dates 테이블 기준 오늘 이전 가장 최근 is_active=true 날짜
// - URL ?date=YYYY-MM-DD 파라미터와 양방향 동기화
// - availableDates: attendance_dates 테이블 (is_active=true, <= today, 내림차순)
// - service_type/label 정보 포함 (DateSpinner 배지 표시용)
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ── 헬퍼 ──────────────────────────────────────────────────

/** YYYY-MM-DD → 로컬 Date 객체 (UTC 파싱 문제 방지: new Date("YYYY-MM-DD")는 UTC 자정으로 해석됨) */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}
/** 날짜 문자열이 YYYY-MM-DD 형식이고 유효한 날짜인지 확인 */
export function isValidDate(str: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = parseLocalDate(str);
  return !isNaN(d.getTime());
}

/** 특정 날짜 기준 가장 최근 일요일 (해당 날짜가 일요일이면 그 날) */
export function toSunday(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() - d.getDay());
  // 로컬 기준 YYYY-MM-DD 추출 (toISOString()은 UTC 기준이므로 사용 금지)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 오늘 기준 가장 최근 일요일 */
export function defaultDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return toSunday(`${y}-${m}-${d}`);
}

/** YYYY-MM-DD → 한국어 요일 */
export function toKoreanDay(dateStr: string): string {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const d = parseLocalDate(dateStr);
  return days[d.getDay()];
}

/** YYYY-MM-DD → 표시 형식 "YYYY-MM-DD (요일)" */
export function formatDateLabel(dateStr: string): string {
  return `${dateStr} (${toKoreanDay(dateStr)})`;
}

/** URL 쿼리에서 date 파라미터 읽기 */
function readDateFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const val = params.get("date");
  if (val && isValidDate(val)) return val;
  return null;
}

/** URL 쿼리에 date 파라미터 쓰기 (replaceState) */
function writeDateToUrl(dateStr: string) {
  const params = new URLSearchParams(window.location.search);
  params.set("date", dateStr);
  const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history.replaceState(null, "", newUrl);
}

// ── 타입 ──────────────────────────────────────────────────

export interface AttendanceDateEntry {
  attendance_date: string;
  service_type: string;
  label: string | null;
  is_default_sunday: boolean;
  is_active: boolean;
}

// ── 컨텍스트 ──────────────────────────────────────────────

interface SelectedDateContextValue {
  /** 현재 선택된 날짜 (YYYY-MM-DD) */
  selectedDate: string;
  /** 날짜 변경 (임의 날짜 허용, URL도 갱신) */
  setSelectedDate: (date: string) => void;
  /** 현재 선택된 날짜의 일요일 보정값 (Home 출석 입력용) */
  selectedSunday: string;
  /** 오늘 기준 최근 일요일인지 여부 */
  isToday: boolean;
  /** 날짜 목록 (내림차순, is_active=true, <= today) */
  availableDates: string[];
  /** 날짜 상세 정보 맵 (attendance_date → AttendanceDateEntry) */
  dateEntries: Map<string, AttendanceDateEntry>;
  /** 날짜 목록 로딩 중 여부 */
  datesLoading: boolean;
  /** 날짜 목록 강제 갱신 */
  refreshDates: () => void;
}

const SelectedDateContext = createContext<SelectedDateContextValue | undefined>(undefined);

export function SelectedDateProvider({ children }: { children: ReactNode }) {
  const [selectedDate, _setSelectedDate] = useState<string>(() => {
    return readDateFromUrl() ?? defaultDate();
  });
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [dateEntries, setDateEntries] = useState<Map<string, AttendanceDateEntry>>(new Map());
  const [datesLoading, setDatesLoading] = useState(true);
  const [fetchTick, setFetchTick] = useState(0);

  // attendance_dates 테이블에서 날짜 목록 fetch
  // - is_active=true, attendance_date <= today, 내림차순
  useEffect(() => {
    let cancelled = false;
    setDatesLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    (async () => {
      const { data, error } = await supabase
        .from("attendance_dates")
        .select("attendance_date, service_type, label, is_default_sunday, is_active")
        .eq("is_active", true)
        .lte("attendance_date", today)
        .order("attendance_date", { ascending: false });

      if (cancelled) return;
      if (!error && data) {
        const entries = data as AttendanceDateEntry[];
        const dates = entries.map((e) => e.attendance_date);
        const entryMap = new Map(entries.map((e) => [e.attendance_date, e]));
        setAvailableDates(dates);
        setDateEntries(entryMap);

        // 초기 진입: URL 날짜 검증 후 기본값 산정
        const fromUrl = readDateFromUrl();
        if (dates.length > 0) {
          // URL 날짜가 목록에 없으면 가장 최신 날짜(dates[0])로 보정
          if (!fromUrl || !dates.includes(fromUrl)) {
            _setSelectedDate(dates[0]);
            writeDateToUrl(dates[0]);
          }
        } else if (!fromUrl) {
          // 목록이 비어 있으면 오늘 기준 최근 일요일 폴백
          const defaultSunday = defaultDate();
          _setSelectedDate(defaultSunday);
          writeDateToUrl(defaultSunday);
        }
      }
      setDatesLoading(false);
    })();
    return () => { cancelled = true; };
  }, [fetchTick]);

  const refreshDates = useCallback(() => setFetchTick((t) => t + 1), []);

  const setSelectedDate = useCallback((date: string) => {
    if (!isValidDate(date)) return;
    _setSelectedDate(date);
    writeDateToUrl(date);
  }, []);

  // 브라우저 뒤로가기/앞으로가기 시 URL 변경 감지
  useEffect(() => {
    function onPopState() {
      const fromUrl = readDateFromUrl();
      if (fromUrl) _setSelectedDate(fromUrl);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const selectedSunday = toSunday(selectedDate);
  const isToday = selectedDate === defaultDate() || selectedSunday === defaultDate();

  return (
    <SelectedDateContext.Provider
      value={{
        selectedDate,
        setSelectedDate,
        selectedSunday,
        isToday,
        availableDates,
        dateEntries,
        datesLoading,
        refreshDates,
      }}
    >
      {children}
    </SelectedDateContext.Provider>
  );
}

export function useSelectedDate() {
  const ctx = useContext(SelectedDateContext);
  if (!ctx) throw new Error("useSelectedDate must be used within SelectedDateProvider");
  return ctx;
}

// 2026년 이상 필터 적용 헬퍼
export function isInValidYear(dateStr: string): boolean {
  return dateStr >= "2026-01-01";
}
