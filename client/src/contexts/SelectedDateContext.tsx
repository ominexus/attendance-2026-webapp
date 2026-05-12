// 전역 선택 날짜 컨텍스트
// - 값 형식: YYYY-MM-DD 문자열
// - 기본값: 오늘 기준 가장 최근 일요일
// - URL ?date=YYYY-MM-DD 파라미터와 양방향 동기화
// - 잘못된 형식이면 무시하고 기본값 사용
// - Home은 일요일 보정 헬퍼(toSunday)를 사용해 표시용으로만 보정
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

// ── 헬퍼 ──────────────────────────────────────────────────

/** 날짜 문자열이 YYYY-MM-DD 형식이고 유효한 날짜인지 확인 */
function isValidDate(str: string): boolean {
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
function defaultDate(): string {
  return toSunday(new Date().toISOString().slice(0, 10));
}

/** URL 쿼리에서 date 파라미터 읽기 */
function readDateFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const val = params.get("date");
  if (val && isValidDate(val)) return val;
  return null;
}

/** URL 쿼리에 date 파라미터 쓰기 (pushState) */
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
}

const SelectedDateContext = createContext<SelectedDateContextValue | undefined>(undefined);

export function SelectedDateProvider({ children }: { children: ReactNode }) {
  const [selectedDate, _setSelectedDate] = useState<string>(() => {
    return readDateFromUrl() ?? defaultDate();
  });

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
      value={{ selectedDate, setSelectedDate, selectedSunday, isToday }}
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
