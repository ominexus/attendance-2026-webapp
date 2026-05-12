// DateSpinner - 출석 기록이 있는 날짜만 표시하는 스피너 컴포넌트
// - availableDates: SelectedDateContext에서 가져온 날짜 목록 (내림차순)
// - ◀ ▶ 버튼: 기록이 있는 이전/다음 날짜로 이동 (인덱스 기반)
// - admin 전용: "새 날짜 입력" 보조 컨트롤 (input type=date)
import { ChevronLeft, ChevronRight, CalendarPlus } from "lucide-react";
import { useState } from "react";
import { useSelectedDate, formatDateLabel, toSunday, isValidDate } from "@/contexts/SelectedDateContext";
import { useAuth } from "@/contexts/AuthContext";

interface DateSpinnerProps {
  /** Home 모드: 날짜를 일요일로 snap (기본 false) */
  snapToSunday?: boolean;
  className?: string;
}

export function DateSpinner({ snapToSunday = false, className = "" }: DateSpinnerProps) {
  const { selectedDate, setSelectedDate, availableDates, datesLoading } = useSelectedDate();
  const { isAdmin } = useAuth();
  const [showNewDate, setShowNewDate] = useState(false);

  // 현재 선택된 날짜의 인덱스 (내림차순 배열에서 0이 최신)
  const idx = availableDates.indexOf(selectedDate);
  // 이전 날짜: 인덱스 +1 (더 오래된 날짜)
  const hasPrev = idx < availableDates.length - 1;
  // 다음 날짜: 인덱스 -1 (더 최신 날짜)
  const hasNext = idx > 0;

  function goPrev() {
    if (hasPrev) setSelectedDate(availableDates[idx + 1]);
  }
  function goNext() {
    if (hasNext) setSelectedDate(availableDates[idx - 1]);
  }

  function handleNewDate(val: string) {
    if (!val || !isValidDate(val)) return;
    const d = snapToSunday ? toSunday(val) : val;
    setSelectedDate(d);
    setShowNewDate(false);
  }

  // 표시할 날짜 (snapToSunday 모드면 일요일로 보정)
  const displayDate = snapToSunday ? toSunday(selectedDate) : selectedDate;
  const label = availableDates.length === 0 && !datesLoading
    ? "출석 기록 없음"
    : formatDateLabel(displayDate);

  return (
    <div className={`flex items-center gap-1 flex-wrap ${className}`}>
      {/* 스피너 컨트롤 */}
      <div className="flex items-center border border-foreground/20 bg-white">
        <button
          type="button"
          onClick={goPrev}
          disabled={!hasPrev || datesLoading}
          className="px-2 py-1.5 hover:bg-foreground/5 transition-colors border-r border-foreground/10 disabled:opacity-30"
          title="이전 날짜"
        >
          <ChevronLeft className="size-3.5" />
        </button>

        <select
          value={displayDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          disabled={datesLoading || availableDates.length === 0}
          className="text-sm tabular-nums px-2 py-1 bg-transparent focus:outline-none min-w-[160px] cursor-pointer disabled:opacity-50"
        >
          {availableDates.length === 0 && !datesLoading && (
            <option value={displayDate}>{label}</option>
          )}
          {availableDates.map((d) => (
            <option key={d} value={d}>
              {formatDateLabel(d)}
            </option>
          ))}
          {/* 선택된 날짜가 목록에 없으면 (새 날짜 입력 중) 임시 옵션 추가 */}
          {availableDates.length > 0 && !availableDates.includes(displayDate) && (
            <option value={displayDate}>{formatDateLabel(displayDate)} *</option>
          )}
        </select>

        <button
          type="button"
          onClick={goNext}
          disabled={!hasNext || datesLoading}
          className="px-2 py-1.5 hover:bg-foreground/5 transition-colors border-l border-foreground/10 disabled:opacity-30"
          title="다음 날짜"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      {/* admin 전용: 새 날짜 입력 보조 컨트롤 */}
      {isAdmin && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowNewDate((v) => !v)}
            className={`flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1.5 border transition-colors ${
              showNewDate
                ? "border-[oklch(0.32_0.05_250)] text-[oklch(0.32_0.05_250)] bg-[oklch(0.95_0.02_250)]"
                : "border-foreground/15 text-muted-foreground hover:border-foreground/30"
            }`}
            title="새 날짜 출석 입력 시작"
          >
            <CalendarPlus className="size-3" />
            새 날짜
          </button>
          {showNewDate && (
            <input
              type="date"
              defaultValue={displayDate}
              onChange={(e) => handleNewDate(e.target.value)}
              className="text-sm tabular-nums px-2 py-1 border border-foreground/20 bg-white focus:outline-none focus:border-[oklch(0.32_0.05_250)] w-36"
              title="새 날짜 직접 입력 (목록에 없는 날짜)"
            />
          )}
        </div>
      )}
    </div>
  );
}
