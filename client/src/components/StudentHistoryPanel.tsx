// Devotional Editorial 스타일 - 학생 출석 이력 슬라이드 패널
// 마일스톤 4-9: 기능 B - 학생 출석 이력 패널
// - 진입점: Home 카드 클릭, Roster 행 클릭
// - 내용: 기본 정보, 요약 지표, 타임라인(최근 12주)
// - admin: 활동 토글, 결석 메모 인라인 편집
// - 비admin: read-only (메모 작성/수정은 기존 정책 유지)
// - UX: 모바일 전체 화면 시트, 데스크톱 우측 슬라이드 패널, ESC/외부 클릭 닫기
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase, type Student, type Attendance, type AbsenceNote } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, X, MessageSquare, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// 가장 최근 일요일 기준 N개 일요일 목록 (내림차순)
function recentSundays(n: number): string[] {
  const result: string[] = [];
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // 이번 주 일요일
  for (let i = 0; i < n; i++) {
    result.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() - 7);
  }
  return result;
}

interface Props {
  student: Student | null;
  onClose: () => void;
  onStudentUpdate?: (updated: Student) => void;
}

export function StudentHistoryPanel({ student, onClose, onStudentUpdate }: Props) {
  const { isAdmin, user, profile } = useAuth();
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [notes, setNotes] = useState<Map<string, AbsenceNote>>(new Map());
  const [loading, setLoading] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [editingNoteDate, setEditingNoteDate] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const sundays = useMemo(() => recentSundays(12), []);

  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    setLoading(true);
    setAttendance([]);
    setNotes(new Map());
    (async () => {
      const [attRes, noteRes] = await Promise.all([
        supabase
          .from("attendance")
          .select("*")
          .eq("student_id", student.id)
          .order("attendance_date", { ascending: false }),
        supabase
          .from("absence_notes")
          .select("*")
          .eq("student_id", student.id)
          .order("attend_date", { ascending: false }),
      ]);
      if (cancelled) return;
      if (!attRes.error) setAttendance((attRes.data as Attendance[]) ?? []);
      if (!noteRes.error) {
        const m = new Map<string, AbsenceNote>();
        for (const n of (noteRes.data as AbsenceNote[]) ?? []) m.set(n.attend_date, n);
        setNotes(m);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [student?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ESC 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 요약 지표
  const attMap = useMemo(() => {
    const m = new Map<string, Attendance>();
    for (const a of attendance) m.set(a.attendance_date, a);
    return m;
  }, [attendance]);

  const totalPresent = attendance.filter((a) => a.status).length;

  const recent4Present = useMemo(() => {
    const r4 = recentSundays(4);
    return r4.filter((d) => attMap.get(d)?.status).length;
  }, [attMap]);

  const streakWeeks = useMemo(() => {
    let streak = 0;
    for (const d of sundays) {
      if (attMap.get(d)?.status) streak++;
      else break;
    }
    return streak;
  }, [attMap, sundays]);

  const lastAttendDate = useMemo(
    () => attendance.filter((a) => a.status).sort((a, b) => b.attendance_date.localeCompare(a.attendance_date))[0]?.attendance_date ?? null,
    [attendance],
  );

  async function toggleActive() {
    if (!student || !isAdmin) return;
    setTogglingActive(true);
    const next = !student.is_active;
    const { error } = await supabase.from("students").update({ is_active: next }).eq("id", student.id);
    if (error) {
      toast.error("변경 실패: " + error.message);
    } else {
      toast.success(`${student.name} → ${next ? "활동" : "비활동"} 처리`, { duration: 1500 });
      onStudentUpdate?.({ ...student, is_active: next });
    }
    setTogglingActive(false);
  }

  async function saveNote(date: string, text: string) {
    if (!student) return;
    const trimmed = text.trim().slice(0, 500);
    const current = notes.get(date);
    if ((current?.note ?? "") === trimmed) { setEditingNoteDate(null); return; }
    if (!trimmed) { setEditingNoteDate(null); return; }

    const optimistic: AbsenceNote = current
      ? { ...current, note: trimmed, updated_at: new Date().toISOString() }
      : {
          id: "tmp-" + date,
          attend_date: date,
          student_id: student.id,
          note: trimmed,
          author_name: profile?.display_name || user?.email || null,
          author_id: user?.id ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
    setNotes((prev) => new Map(prev).set(date, optimistic));

    const { data, error } = await supabase
      .from("absence_notes")
      .upsert(
        {
          attend_date: date,
          student_id: student.id,
          note: trimmed,
          author_name: profile?.display_name || user?.email || null,
          author_id: user?.id ?? null,
        },
        { onConflict: "attend_date,student_id" },
      )
      .select()
      .single();

    if (error) {
      setNotes((prev) => {
        const m = new Map(prev);
        if (current) m.set(date, current);
        else m.delete(date);
        return m;
      });
      toast.error("메모 저장 실패: " + error.message);
    } else if (data) {
      setNotes((prev) => new Map(prev).set(date, data as AbsenceNote));
      toast.success("메모 저장됨", { duration: 1200 });
    }
    setEditingNoteDate(null);
  }

  const open = !!student;

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
        className={cn(
          "fixed inset-0 z-40 transition-opacity duration-300",
          open ? "bg-black/30 pointer-events-auto" : "bg-transparent pointer-events-none opacity-0",
        )}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed z-50 bg-[oklch(0.97_0.012_85)] border-l border-foreground/15 shadow-2xl transition-transform duration-300 ease-in-out",
          "inset-y-0 right-0 w-full sm:w-[480px] overflow-y-auto",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {student && (
          <div className="flex flex-col min-h-full">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[oklch(0.97_0.012_85)] border-b border-foreground/10 px-6 py-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                  Student Record
                </div>
                <h2 className="font-display text-3xl italic mt-0.5">{student.name}</h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    {student.grade} {student.class_num}
                  </span>
                  {student.gender && (
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-wider px-1.5 py-0.5 border",
                        student.gender === "남"
                          ? "bg-[oklch(0.93_0.04_250)] border-[oklch(0.75_0.08_250)] text-[oklch(0.32_0.05_250)]"
                          : "bg-[oklch(0.95_0.04_10)] border-[oklch(0.78_0.08_10)] text-[oklch(0.42_0.1_10)]",
                      )}
                    >
                      {student.gender}
                    </span>
                  )}
                  {student.guide && (
                    <span className="text-xs text-muted-foreground">인도자: {student.guide}</span>
                  )}
                  {/* 활동 상태 배지 + admin 토글 */}
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={toggleActive}
                      disabled={togglingActive}
                      className={cn(
                        "inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-0.5 border transition-colors",
                        student.is_active
                          ? "border-[oklch(0.75_0.08_250)] text-[oklch(0.32_0.05_250)] bg-[oklch(0.93_0.04_250)] hover:bg-[oklch(0.88_0.06_250)]"
                          : "border-foreground/20 text-muted-foreground bg-foreground/5 hover:bg-foreground/10",
                      )}
                    >
                      {togglingActive ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <span
                          className={cn(
                            "inline-block w-5 h-3 rounded-full transition-colors relative",
                            student.is_active ? "bg-[oklch(0.32_0.05_250)]" : "bg-foreground/20",
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 size-2 rounded-full bg-white transition-transform",
                              student.is_active ? "translate-x-2.5" : "translate-x-0.5",
                            )}
                          />
                        </span>
                      )}
                      {student.is_active ? "활동" : "비활동"}
                    </button>
                  ) : (
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-wider px-1.5 py-0.5 border",
                        student.is_active
                          ? "border-[oklch(0.75_0.08_250)] text-[oklch(0.32_0.05_250)] bg-[oklch(0.93_0.04_250)]"
                          : "border-foreground/20 text-muted-foreground bg-foreground/5",
                      )}
                    >
                      {student.is_active ? "활동" : "비활동"}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 hover:bg-foreground/10 rounded transition-colors shrink-0"
                aria-label="닫기"
              >
                <X className="size-5" />
              </button>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="animate-spin size-4" />
                이력 로드 중…
              </div>
            ) : (
              <div className="px-6 py-5 space-y-8">
                {/* 요약 지표 */}
                <section>
                  <SectionTitle en="Summary" ko="요약 지표" />
                  <div className="grid grid-cols-2 gap-2.5">
                    <KpiMini label="누적 출석" value={`${totalPresent}회`} />
                    <KpiMini label="최근 4주 출석" value={`${recent4Present}회`} />
                    <KpiMini label="연속 출석" value={streakWeeks > 0 ? `${streakWeeks}주` : "—"} />
                    <KpiMini
                      label="마지막 출석일"
                      value={lastAttendDate ? lastAttendDate.slice(5) : "—"}
                    />
                  </div>
                </section>

                {/* 타임라인 */}
                <section>
                  <SectionTitle en="Timeline" ko="최근 12주 출석 이력" />
                  <div className="space-y-1">
                    {sundays.map((d) => {
                      const att = attMap.get(d);
                      const present = att?.status ?? false;
                      const note = notes.get(d);
                      const isEditingNote = editingNoteDate === d;

                      return (
                        <div
                          key={d}
                          className={cn(
                            "border px-3 py-2.5 transition-colors",
                            present
                              ? "border-[oklch(0.45_0.18_25)]/30 bg-white"
                              : "border-foreground/8 bg-foreground/2",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {/* 날짜 */}
                            <div className="font-display italic text-sm tabular-nums text-muted-foreground w-16 shrink-0">
                              {d.slice(5)}
                            </div>

                            {/* 상태 */}
                            <div
                              className={cn(
                                "text-[10px] uppercase tracking-wider px-2 py-0.5 border shrink-0",
                                present
                                  ? "border-[oklch(0.45_0.18_25)] text-[oklch(0.45_0.18_25)] bg-white"
                                  : "border-foreground/15 text-muted-foreground bg-transparent",
                              )}
                            >
                              {present ? "출석" : "결석"}
                            </div>

                            {/* 메모 버튼 (결석 시) */}
                            {!present && (
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingNoteDate(isEditingNote ? null : d)
                                }
                                className={cn(
                                  "flex items-center gap-1 text-[11px] hover:text-foreground transition-colors ml-auto",
                                  note?.note ? "text-foreground/70" : "text-muted-foreground",
                                )}
                              >
                                <MessageSquare className="size-3 shrink-0" />
                                {note?.note ? "메모 편집" : "메모"}
                              </button>
                            )}
                          </div>

                          {/* 메모 표시 */}
                          {!present && note?.note && !isEditingNote && (
                            <div className="mt-1.5 ml-[76px] text-xs text-foreground/70 flex items-start gap-1">
                              <MessageSquare className="size-3 mt-0.5 shrink-0 text-muted-foreground" />
                              <span className="whitespace-pre-wrap">{note.note}</span>
                            </div>
                          )}
                          {note?.author_name && !isEditingNote && note.note && (
                            <div className="ml-[76px] text-[10px] text-muted-foreground/60 uppercase tracking-wider mt-0.5">
                              · {note.author_name}
                            </div>
                          )}

                          {/* 메모 편집 */}
                          {!present && isEditingNote && (
                            <div className="mt-2 ml-[76px]">
                              <InlineNoteEditor
                                initial={note?.note ?? ""}
                                onSave={(v) => saveNote(d, v)}
                                onCancel={() => setEditingNoteDate(null)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function SectionTitle({ en, ko }: { en: string; ko: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-3">
      <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">{en}</div>
      <div className="h-px flex-1 bg-foreground/12" />
      <div className="font-display italic text-xs text-muted-foreground">{ko}</div>
    </div>
  );
}

function KpiMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-foreground/10 bg-white px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display italic text-xl mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}

function InlineNoteEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.setSelectionRange(value.length, value.length);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-1.5">
      <textarea
        ref={ref}
        value={value}
        maxLength={500}
        rows={2}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSave(value); }
          else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        }}
        placeholder="결석 사유 입력 · ⌘/Ctrl+Enter 저장"
        className="w-full text-xs px-2 py-1.5 border border-foreground/20 bg-white resize-none focus:outline-none focus:border-[oklch(0.32_0.05_250)]"
      />
      <div className="flex gap-1 justify-end">
        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={onCancel}>취소</Button>
        <Button
          size="sm"
          className="h-6 px-2 text-[10px] bg-[oklch(0.32_0.05_250)] hover:bg-[oklch(0.28_0.05_250)]"
          onClick={() => onSave(value)}
        >
          <Check className="size-3" /> 저장
        </Button>
      </div>
    </div>
  );
}
