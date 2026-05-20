// Devotional Editorial 스타일 - 학생 출석 이력 슬라이드 패널
// 마일스톤 4-9: 기능 B - 학생 출석 이력 패널
// 마일스톤 4-12: 관리자 인라인 학생 정보 편집 (이름/학년/반/성별/데려온 친구/활동 여부)
// - 학년/반 변경 시 confirm 후 저장 → Home 그룹핑 자동 갱신
// - Optimistic UI + 실패 시 롤백, 토스트 결과 안내
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase, type Student, type Attendance, type AbsenceNote } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, X, MessageSquare, Check, Pencil, Save, RotateCcw } from "lucide-react";
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

const GRADES = ["1학년", "2학년", "3학년"];
const CLASSES = ["1반", "2반", "3반", "4반", "5반"];

interface EditableFields {
  name: string;
  grade: string;
  class_num: string;
  gender: string;
  guide: string;
  school: string;
  phone: string;
  is_active: boolean;
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

  // 인라인 편집 상태
  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState<EditableFields | null>(null);
  const [saving, setSaving] = useState(false);

  const sundays = useMemo(() => recentSundays(12), []);

  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    setLoading(true);
    setAttendance([]);
    setNotes(new Map());
    setIsEditing(false);
    setEditFields(null);
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
      if (e.key === "Escape") {
        if (isEditing) { setIsEditing(false); setEditFields(null); }
        else onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isEditing]);

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

  // 편집 시작
  function startEdit() {
    if (!student) return;
    setEditFields({
      name: student.name ?? "",
      grade: student.grade ?? "1학년",
      class_num: student.class_num ?? "1반",
      gender: student.gender ?? "",
      guide: student.guide ?? "",
      school: student.school ?? "",
      phone: student.phone ?? "",
      is_active: student.is_active ?? true,
    });
    setIsEditing(true);
  }

  // 편집 취소
  function cancelEdit() {
    setIsEditing(false);
    setEditFields(null);
  }

  // 편집 저장
  const saveEdit = useCallback(async () => {
    if (!student || !editFields) return;

    const gradeChanged = editFields.grade !== student.grade;
    const classChanged = editFields.class_num !== student.class_num;
    if ((gradeChanged || classChanged) && !window.confirm(
      `학년/반을 ${editFields.grade} ${editFields.class_num}(으)로 변경합니다.\n이 학생은 새로운 반으로 이동합니다. 계속하시겠습니까?`
    )) return;

    setSaving(true);
    const prev = { ...student };
    // Optimistic: 패널 헤더 즉시 반영
    const updated: Student = {
      ...student,
      name: editFields.name.trim() || student.name,
      grade: editFields.grade,
      class_num: editFields.class_num,
      gender: editFields.gender,
      guide: editFields.guide.trim() || null,
      school: editFields.school.trim() || null,
      phone: editFields.phone.trim() || null,
      is_active: editFields.is_active,
    };
    onStudentUpdate?.(updated);

    const { error } = await supabase.from("students").update({
      name: updated.name,
      grade: updated.grade,
      class_num: updated.class_num,
      gender: updated.gender,
      guide: updated.guide,
      school: updated.school,
      phone: updated.phone,
      is_active: updated.is_active,
    }).eq("id", student.id);

    if (error) {
      onStudentUpdate?.(prev); // 롤백
      toast.error("저장 실패: " + error.message);
    } else {
      toast.success("학생 정보 저장됨", { duration: 1500 });
      setIsEditing(false);
      setEditFields(null);
    }
    setSaving(false);
  }, [student, editFields, onStudentUpdate]);

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
  const displayStudent = isEditing && editFields ? { ...student!, ...editFields } : student;

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
        {student && displayStudent && (
          <div className="flex flex-col min-h-full">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[oklch(0.97_0.012_85)] border-b border-foreground/10 px-6 py-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                  Student Record
                </div>
                {isEditing && editFields ? (
                  <Input
                    value={editFields.name}
                    onChange={(e) => setEditFields((f) => f && { ...f, name: e.target.value })}
                    className="font-display text-2xl italic mt-0.5 h-auto py-0.5 px-1 border-0 border-b border-foreground/30 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-foreground"
                  />
                ) : (
                  <h2 className="font-display text-3xl italic mt-0.5">{displayStudent.name}</h2>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    {displayStudent.grade} {displayStudent.class_num}
                  </span>
                  {displayStudent.gender && (
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-wider px-1.5 py-0.5 border",
                        displayStudent.gender === "남"
                          ? "bg-[oklch(0.93_0.04_250)] border-[oklch(0.75_0.08_250)] text-[oklch(0.32_0.05_250)]"
                          : "bg-[oklch(0.95_0.04_10)] border-[oklch(0.78_0.08_10)] text-[oklch(0.42_0.1_10)]",
                      )}
                    >
                      {displayStudent.gender}
                    </span>
                  )}
                  {displayStudent.guide && (
                    <span className="text-xs text-muted-foreground">데려온 친구: {displayStudent.guide}</span>
                  )}
                  {displayStudent.school && (
                    <span className="text-xs text-muted-foreground">학교: {displayStudent.school}</span>
                  )}
                  {displayStudent.phone && (
                    <span className="text-xs text-muted-foreground">전화: {displayStudent.phone}</span>
                  )}
                  {/* 활동 상태 배지 + admin 토글 (편집 모드 아닐 때만) */}
                  {!isEditing && (
                    isAdmin ? (
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
                          <span className={cn("inline-block w-5 h-3 rounded-full transition-colors relative", student.is_active ? "bg-[oklch(0.32_0.05_250)]" : "bg-foreground/20")}>
                            <span className={cn("absolute top-0.5 size-2 rounded-full bg-white transition-transform", student.is_active ? "translate-x-2.5" : "translate-x-0.5")} />
                          </span>
                        )}
                        {student.is_active ? "활동" : "비활동"}
                      </button>
                    ) : (
                      <span className={cn("text-[10px] uppercase tracking-wider px-1.5 py-0.5 border", student.is_active ? "border-[oklch(0.75_0.08_250)] text-[oklch(0.32_0.05_250)] bg-[oklch(0.93_0.04_250)]" : "border-foreground/20 text-muted-foreground bg-foreground/5")}>
                        {student.is_active ? "활동" : "비활동"}
                      </span>
                    )
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isAdmin && !isEditing && (
                  <button
                    type="button"
                    onClick={startEdit}
                    className="p-1.5 hover:bg-foreground/10 rounded transition-colors text-muted-foreground hover:text-foreground"
                    title="학생 정보 편집"
                  >
                    <Pencil className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 hover:bg-foreground/10 rounded transition-colors"
                  aria-label="닫기"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="animate-spin size-4" />
                이력 로드 중…
              </div>
            ) : (
              <div className="px-6 py-5 space-y-8">

                {/* 인라인 편집 폼 (admin + 편집 모드) */}
                {isAdmin && isEditing && editFields && (
                  <section>
                    <SectionTitle en="Edit" ko="학생 정보 편집" />
                    <div className="space-y-3 border border-[oklch(0.32_0.05_250)]/20 bg-white p-4">
                      {/* 학년 / 반 */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">학년</label>
                          <select
                            value={editFields.grade}
                            onChange={(e) => setEditFields((f) => f && { ...f, grade: e.target.value })}
                            className="w-full text-sm border border-foreground/20 bg-transparent px-2 py-1.5 focus:outline-none focus:border-[oklch(0.32_0.05_250)]"
                          >
                            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">반</label>
                          <select
                            value={editFields.class_num}
                            onChange={(e) => setEditFields((f) => f && { ...f, class_num: e.target.value })}
                            className="w-full text-sm border border-foreground/20 bg-transparent px-2 py-1.5 focus:outline-none focus:border-[oklch(0.32_0.05_250)]"
                          >
                            {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* 성별 */}
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">성별</label>
                        <div className="flex gap-2">
                          {["남", "여", ""].map((g) => (
                            <button
                              key={g || "none"}
                              type="button"
                              onClick={() => setEditFields((f) => f && { ...f, gender: g })}
                              className={cn(
                                "px-3 py-1 text-xs border transition-colors",
                                editFields.gender === g
                                  ? "bg-[oklch(0.32_0.05_250)] text-white border-[oklch(0.32_0.05_250)]"
                                  : "border-foreground/20 text-muted-foreground hover:border-foreground/40",
                              )}
                            >
                              {g || "미지정"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 데려온 친구 */}
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">데려온 친구</label>
                        <Input
                          value={editFields.guide}
                          onChange={(e) => setEditFields((f) => f && { ...f, guide: e.target.value })}
                          placeholder="이름 입력"
                          className="h-8 text-sm border-foreground/20 rounded-none focus-visible:ring-0 focus-visible:border-[oklch(0.32_0.05_250)]"
                        />
                      </div>

                      {/* 학교 */}
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">학교</label>
                        <Input
                          value={editFields.school}
                          onChange={(e) => setEditFields((f) => f && { ...f, school: e.target.value })}
                          placeholder="학교명 입력"
                          className="h-8 text-sm border-foreground/20 rounded-none focus-visible:ring-0 focus-visible:border-[oklch(0.32_0.05_250)]"
                        />
                      </div>

                      {/* 전화번호 */}
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">전화번호</label>
                        <Input
                          value={editFields.phone}
                          onChange={(e) => setEditFields((f) => f && { ...f, phone: e.target.value })}
                          placeholder="010-0000-0000"
                          className="h-8 text-sm border-foreground/20 rounded-none focus-visible:ring-0 focus-visible:border-[oklch(0.32_0.05_250)]"
                        />
                      </div>

                      {/* 활동 여부 */}
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">활동 여부</label>
                        <button
                          type="button"
                          onClick={() => setEditFields((f) => f && { ...f, is_active: !f.is_active })}
                          className={cn(
                            "inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-0.5 border transition-colors",
                            editFields.is_active
                              ? "border-[oklch(0.75_0.08_250)] text-[oklch(0.32_0.05_250)] bg-[oklch(0.93_0.04_250)]"
                              : "border-foreground/20 text-muted-foreground bg-foreground/5",
                          )}
                        >
                          <span className={cn("inline-block w-5 h-3 rounded-full relative", editFields.is_active ? "bg-[oklch(0.32_0.05_250)]" : "bg-foreground/20")}>
                            <span className={cn("absolute top-0.5 size-2 rounded-full bg-white transition-transform", editFields.is_active ? "translate-x-2.5" : "translate-x-0.5")} />
                          </span>
                          {editFields.is_active ? "활동" : "비활동"}
                        </button>
                      </div>

                      {/* 저장/취소 버튼 */}
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={saveEdit}
                          disabled={saving}
                          className="flex-1 bg-[oklch(0.32_0.05_250)] hover:bg-[oklch(0.28_0.05_250)] rounded-none h-8 text-xs uppercase tracking-wider"
                        >
                          {saving ? <Loader2 className="size-3 animate-spin" /> : <><Save className="size-3 mr-1" />저장</>}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEdit}
                          disabled={saving}
                          className="flex-1 rounded-none h-8 text-xs uppercase tracking-wider border-foreground/20"
                        >
                          <RotateCcw className="size-3 mr-1" />취소
                        </Button>
                      </div>
                    </div>
                  </section>
                )}

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
                            <div className="font-display italic text-sm tabular-nums text-muted-foreground w-16 shrink-0">
                              {d.slice(5)}
                            </div>
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
                            {!present && (
                              <button
                                type="button"
                                onClick={() => setEditingNoteDate(isEditingNote ? null : d)}
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
