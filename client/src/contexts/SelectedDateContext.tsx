// 전역 선택 날짜 컨텍스트
// - 값 형식: YYYY-MM-DD 문자열
// - 기본값: 가장 최근 출석 기록 날짜, 없으면 오늘 기준 가장 최근 일요일
// - URL ?date=YYYY-MM-DD 파라미터와 양방향 동기화
// - availableDates: attendance 테이블 distinct(attendance_date) 목록
// - Home은 일요일 보정 헬퍼(toSunday)를 사용해 표시용으로만 보정
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ── 헬퍼 ──────────────────────────────────────────────────

/** 날짜 문자열이 YYYY-MM-DD 형식이고 유효한 날짜인지 확인 */
export function isValidDate(str: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str + "T00:00:00");
  return !isNaN(d.getTime());
}

/** 특정 날짜 기준 가장 최근 일요일 (해당 날짜가 일요일이면 그 날) */
export function toSunday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

/** 오늘 기준 가장 최근 일요일 */
export function defaultDate(): string {
  return toSunday(new Date().toISOString().slice(0, 10));
}

/** YYYY-MM-DD → 한국어 요일 */
export function toKoreanDay(dateStr: string): string {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const d = new Date(dateStr + "T00:00:00");
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
  /** 출석 기록이 있는 날짜 목록 (내림차순 정렬) */
  availableDates: string[];
  /** 날짜 목록 로딩 중 여부 */
  datesLoading: boolean;
  /** 날짜 목록 강제 갱신 (새 출석 입력 후 호출) */
  refreshDates: () => void;
}

const SelectedDateContext = createContext<SelectedDateContextValue | undefined>(undefined);

export function SelectedDateProvider({ children }: { children: ReactNode }) {
  const [selectedDate, _setSelectedDate] = useState<string>(() => {
    return readDateFromUrl() ?? defaultDate();
  });
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [datesLoading, setDatesLoading] = useState(true);
  const [fetchTick, setFetchTick] = useState(0);

  // attendance 테이블에서 distinct 날짜 목록 fetch
  useEffect(() => {
    let cancelled = false;
    setDatesLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("attendance_date")
        .order("attendance_date", { ascending: false });
      if (cancelled) return;
      if (!error && data) {
        const unique = Array.from(new Set(data.map((r: { attendance_date: string }) => r.attendance_date))).sort(
          (a, b) => b.localeCompare(a),
        ) as string[];
        setAvailableDates(unique);
        // 초기 진입: URL에 날짜가 없으면 가장 최근 기록 날짜로 설정
        const fromUrl = readDateFromUrl();
        if (!fromUrl && unique.length > 0) {
          _setSelectedDate(unique[0]);
          writeDateToUrl(unique[0]);
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
