// Devotional Editorial 스타일 - 명단 관리
// 마일스톤 4-8: is_active 활동 필터 + 행별 토글 스위치 + 다이얼로그 체크박스
// 마일스톤 4-9: 학생 행 클릭 → 이력 패널 + 비활동 후보 알림 배지/모달 (기능 A)
import { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase, type Student, type Teacher, type Attendance } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Upload, Download, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import { StudentHistoryPanel } from "@/components/StudentHistoryPanel";

type Tab = "students" | "teachers";
type ActiveFilter = "all" | "active" | "inactive";

// 가장 최근 일요일 기준 N개 일요일 목록 (내림차순)
function recentSundays(n: number): string[] {
  const result: string[] = [];
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  for (let i = 0; i < n; i++) {
    result.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() - 7);
  }
  return result;
}

const STUDENT_FIELDS: Array<keyof Student> = [
  "grade", "class_num", "name", "gender", "phone", "birth_date", "school", "guide", "is_active",
];
const STUDENT_LABELS: Record<string, string> = {
  grade: "학년", class_num: "반", name: "이름", gender: "성별",
  phone: "연락처", birth_date: "생년월일", school: "학교", guide: "데려온 친구", is_active: "활동",
};

interface InactiveCandidate {
  student: Student;
  lastAttendDate: string | null;
  absentWeeks: number;
}

export default function Roster() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>("students");
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allAttendance, setAllAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");
  const [editing, setEditing] = useState<
    | { kind: "student"; data: Partial<Student> }
    | { kind: "teacher"; data: Partial<Teacher> }
    | null
  >(null);
  const [keyword, setKeyword] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 이력 패널
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);
  // 비활동 후보 모달
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [inactiveThreshold, setInactiveThreshold] = useState<number>(4);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [processingBulk, setProcessingBulk] = useState(false);

  async function reload() {
    setLoading(true);
    const [{ data: s }, { data: t }, { data: a }] = await Promise.all([
      supabase.from("students").select("*").order("grade").order("class_num").order("name"),
      supabase.from("teachers").select("*").order("role").order("name"),
      // 최근 8주 출석 기록만 (후보 산정에 충분)
      supabase
        .from("attendance")
        .select("student_id,attendance_date,status")
        .gte("attendance_date", recentSundays(8)[7])
        .eq("status", true),
    ]);
    setStudents((s as Student[]) ?? []);
    setTeachers((t as Teacher[]) ?? []);
    setAllAttendance((a as Attendance[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { reload(); }, []);

  // ── 비활동 후보 산정 ──────────────────────────────────────
  const inactiveCandidates = useMemo<InactiveCandidate[]>(() => {
    const sundays = recentSundays(inactiveThreshold);
    const cutoff = sundays[sundays.length - 1]; // N주 전 일요일

    // 학생별 출석 날짜 집합
    const attByStudent = new Map<string, Set<string>>();
    for (const a of allAttendance) {
      if (!attByStudent.has(a.student_id)) attByStudent.set(a.student_id, new Set());
      attByStudent.get(a.student_id)!.add(a.attendance_date);
    }

    const candidates: InactiveCandidate[] = [];
    for (const s of students) {
      if (!s.is_active) continue;
      // 신규 학생 제외: created_at이 N주 이내
      if (s.created_at && new Date(s.created_at) >= new Date(cutoff)) continue;

      const dates = attByStudent.get(s.id) ?? new Set<string>();
      // 최근 N개 일요일 중 출석한 날이 하나도 없으면 후보
      const hasAnyPresent = sundays.some((d) => dates.has(d));
      if (hasAnyPresent) continue;

      // 마지막 출석일 (전체 기록 중)
      const allDates = Array.from(dates).sort().reverse();
      const lastAttendDate = allDates[0] ?? null;

      candidates.push({ student: s, lastAttendDate, absentWeeks: inactiveThreshold });
    }
    return candidates.sort((a, b) =>
      (a.lastAttendDate ?? "0000").localeCompare(b.lastAttendDate ?? "0000"),
    );
  }, [students, allAttendance, inactiveThreshold]);

  // 비활동 후보 일괄 처리
  async function bulkSetInactive() {
    if (selectedCandidates.size === 0) return;
    setProcessingBulk(true);
    const ids = Array.from(selectedCandidates);
    const { error } = await supabase
      .from("students")
      .update({ is_active: false })
      .in("id", ids);
    if (error) {
      toast.error("일괄 처리 실패: " + error.message);
    } else {
      toast.success(`${ids.length}명 비활동 처리 완료`);
      setStudents((prev) =>
        prev.map((s) => (ids.includes(s.id) ? { ...s, is_active: false } : s)),
      );
      setSelectedCandidates(new Set());
      setShowCandidateModal(false);
    }
    setProcessingBulk(false);
  }

  // 활동 필터 적용
  const filteredStudents = useMemo(() => {
    let list = students;
    if (activeFilter === "active") list = list.filter((s) => s.is_active);
    else if (activeFilter === "inactive") list = list.filter((s) => !s.is_active);
    if (keyword) {
      list = list.filter((s) =>
        [s.name, s.grade, s.class_num, s.school, s.guide]
          .filter(Boolean)
          .some((v) => String(v).includes(keyword)),
      );
    }
    return list;
  }, [students, activeFilter, keyword]);

  const filteredTeachers = useMemo(
    () => keyword ? teachers.filter((t) => [t.name, t.role].some((v) => v?.includes(keyword))) : teachers,
    [teachers, keyword],
  );

  const activeCount = students.filter((s) => s.is_active).length;
  const inactiveCount = students.filter((s) => !s.is_active).length;

  async function save() {
    if (!editing) return;
    const { kind, data } = editing;
    const table = kind === "student" ? "students" : "teachers";
    const payload = { ...data };
    delete (payload as { created_at?: string }).created_at;
    const { error } = data.id
      ? await supabase.from(table).update(payload).eq("id", data.id)
      : await supabase.from(table).insert(payload);
    if (error) toast.error("저장 실패: " + error.message);
    else { toast.success("저장되었습니다"); setEditing(null); reload(); }
  }

  async function remove(kind: Tab, id: string, label: string) {
    if (!confirm(`${label} 항목을 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from(kind).delete().eq("id", id);
    if (error) toast.error("삭제 실패: " + error.message);
    else { toast.success("삭제되었습니다"); reload(); }
  }

  async function toggleActive(s: Student) {
    if (!isAdmin) return;
    setTogglingId(s.id);
    const next = !s.is_active;
    setStudents((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: next } : x)));
    const { error } = await supabase.from("students").update({ is_active: next }).eq("id", s.id);
    if (error) {
      setStudents((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: !next } : x)));
      toast.error("변경 실패: " + error.message);
    } else {
      toast.success(`${s.name} → ${next ? "활동" : "비활동"} 처리`, { duration: 1500 });
    }
    setTogglingId(null);
  }

  async function bulkUpload(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
      if (rows.length === 0) { toast.error("빈 파일입니다"); return; }
      const reverseLabel: Record<string, string> = {};
      for (const [k, v] of Object.entries(STUDENT_LABELS)) reverseLabel[v] = k;
      const records = rows.map((r) => {
        const obj: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) {
          const key = reverseLabel[k] || k;
          if (key === "is_active") {
            if (v === null || v === undefined || v === "") obj[key] = true;
            else if (typeof v === "boolean") obj[key] = v;
            else if (String(v).trim() === "활동" || String(v).trim() === "true") obj[key] = true;
            else if (String(v).trim() === "비활동" || String(v).trim() === "false") obj[key] = false;
            else obj[key] = true;
          } else {
            obj[key] = v === "" ? null : v;
          }
        }
        if (!("is_active" in obj)) obj["is_active"] = true;
        return obj;
      });
      const table = tab === "students" ? "students" : "teachers";
      const { error } = await supabase.from(table).insert(records);
      if (error) toast.error("일괄 등록 실패: " + error.message);
      else { toast.success(`${records.length}건 등록 완료`); reload(); }
    } catch (e) {
      toast.error("파싱 오류: " + (e as Error).message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function downloadTemplate() {
    const headers = tab === "students"
      ? STUDENT_FIELDS.map((f) => STUDENT_LABELS[f as string] ?? f)
      : ["역할", "이름"];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab);
    XLSX.writeFile(wb, `${tab}_template.xlsx`);
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-8 flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Roster Management</div>
            <h1 className="font-display text-4xl italic mt-1">명단 관리</h1>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="bg-white">
                <Download className="size-3.5" /> 템플릿
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="bg-white">
                <Upload className="size-3.5" /> 일괄 등록
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                hidden
                onChange={(e) => e.target.files?.[0] && bulkUpload(e.target.files[0])}
              />
              <Button
                size="sm"
                onClick={() =>
                  setEditing(
                    tab === "students"
                      ? { kind: "student", data: { grade: "1학년", class_num: "1반", is_active: true } }
                      : { kind: "teacher", data: { role: "교사" } },
                  )
                }
                className="bg-[oklch(0.32_0.05_250)] text-white hover:bg-[oklch(0.28_0.05_250)]"
              >
                <Plus className="size-3.5" /> 추가
              </Button>
            </div>
          )}
        </header>

        {/* Tabs + Search */}
        <div className="flex items-center justify-between mb-4 border-b border-foreground/15">
          <div className="flex">
            {(["students", "teachers"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm uppercase tracking-wider border-b-2 -mb-px transition-colors ${
                  tab === t
                    ? "border-[oklch(0.32_0.05_250)] text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "students" ? `학생 (${students.length})` : `교사 (${teachers.length})`}
              </button>
            ))}
          </div>
          <Input
            placeholder="이름·반·학교 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="max-w-xs h-9"
          />
        </div>

        {/* 학생 탭 전용 컨트롤 */}
        {tab === "students" && (
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {/* 활동 필터 */}
            {(
              [
                { key: "all", label: `전체 (${students.length})` },
                { key: "active", label: `활동 (${activeCount})` },
                { key: "inactive", label: `비활동 (${inactiveCount})` },
              ] as { key: ActiveFilter; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={cn(
                  "text-xs px-3 py-1.5 border transition-colors",
                  activeFilter === key
                    ? "border-[oklch(0.32_0.05_250)] bg-[oklch(0.93_0.04_250)] text-[oklch(0.32_0.05_250)]"
                    : "border-foreground/15 bg-white/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}

            {/* 비활동 후보 알림 배지 (admin 전용) */}
            {isAdmin && inactiveCandidates.length > 0 && (
              <button
                type="button"
                onClick={() => { setSelectedCandidates(new Set()); setShowCandidateModal(true); }}
                className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 border border-[oklch(0.65_0.12_25)] bg-[oklch(0.97_0.02_25)] text-[oklch(0.45_0.18_25)] hover:bg-[oklch(0.94_0.04_25)] transition-colors"
              >
                <AlertTriangle className="size-3.5" />
                비활동 후보 {inactiveCandidates.length}명
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="animate-spin size-4" /> 불러오는 중…
          </div>
        ) : tab === "students" ? (
          <StudentTable
            rows={filteredStudents}
            canWrite={isAdmin}
            togglingId={togglingId}
            onRowClick={(s) => setHistoryStudent(s)}
            onEdit={(s) => { setEditing({ kind: "student", data: s }); }}
            onDelete={(s) => remove("students", s.id, s.name)}
            onToggleActive={toggleActive}
          />
        ) : (
          <TeacherTable
            rows={filteredTeachers}
            canWrite={isAdmin}
            onEdit={(t) => setEditing({ kind: "teacher", data: t })}
            onDelete={(t) => remove("teachers", t.id, t.name)}
          />
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display italic text-xl">
              {editing?.data.id ? "편집" : "추가"} · {editing?.kind === "student" ? "학생" : "교사"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            {editing?.kind === "student" &&
              STUDENT_FIELDS.map((f) => {
                if (f === "gender") {
                  return (
                    <GenderSelect
                      key={f}
                      value={(editing.data as Record<string, unknown>)["gender"] as string | null}
                      onChange={(v) => setEditing({ kind: "student", data: { ...editing.data, gender: v } })}
                    />
                  );
                }
                if (f === "is_active") {
                  return (
                    <ActiveCheckbox
                      key={f}
                      value={(editing.data as Record<string, unknown>)["is_active"] as boolean ?? true}
                      onChange={(v) => setEditing({ kind: "student", data: { ...editing.data, is_active: v } })}
                    />
                  );
                }
                return (
                  <Field
                    key={f}
                    label={STUDENT_LABELS[f as string] ?? f}
                    value={(editing.data as Record<string, unknown>)[f as string] as string | null}
                    onChange={(v) => setEditing({ kind: "student", data: { ...editing.data, [f]: v } })}
                    type={f === "birth_date" ? "date" : "text"}
                  />
                );
              })}
            {editing?.kind === "teacher" && (
              <>
                <Field label="역할" value={editing.data.role ?? ""} onChange={(v) => setEditing({ kind: "teacher", data: { ...editing.data, role: v } })} />
                <Field label="이름" value={editing.data.name ?? ""} onChange={(v) => setEditing({ kind: "teacher", data: { ...editing.data, name: v } })} />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>취소</Button>
            <Button onClick={save} className="bg-[oklch(0.32_0.05_250)] text-white hover:bg-[oklch(0.28_0.05_250)]">저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 비활동 후보 모달 */}
      {showCandidateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowCandidateModal(false)} />
          <div className="relative bg-[oklch(0.97_0.012_85)] border border-foreground/15 shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* 모달 헤더 */}
            <div className="px-6 py-4 border-b border-foreground/10 flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Inactive Candidates</div>
                <h2 className="font-display text-2xl italic mt-0.5">비활동 후보</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  최근{" "}
                  <select
                    value={inactiveThreshold}
                    onChange={(e) => setInactiveThreshold(Number(e.target.value))}
                    className="inline-block bg-white border border-input rounded px-1 py-0.5 text-xs mx-1"
                  >
                    {[2, 3, 4, 5, 8].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  주 동안 출석 기록이 없는 활동 학생 · 신규 학생 제외
                </p>
              </div>
              <button type="button" onClick={() => setShowCandidateModal(false)} className="p-1.5 hover:bg-foreground/10 rounded">
                <X className="size-5" />
              </button>
            </div>

            {/* 후보 목록 */}
            <div className="overflow-y-auto flex-1">
              {inactiveCandidates.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-12">
                  기준({inactiveThreshold}주) 내 후보가 없습니다.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[oklch(0.97_0.012_85)]">
                    <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-foreground/10">
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedCandidates.size === inactiveCandidates.length}
                          onChange={(e) =>
                            setSelectedCandidates(
                              e.target.checked
                                ? new Set(inactiveCandidates.map((c) => c.student.id))
                                : new Set(),
                            )
                          }
                        />
                      </th>
                      <th className="px-4 py-3">이름</th>
                      <th className="px-4 py-3">학년 · 반</th>
                      <th className="px-4 py-3">데려온 친구</th>
                      <th className="px-4 py-3">마지막 출석일</th>
                      <th className="px-4 py-3">연속 결석</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveCandidates.map(({ student, lastAttendDate, absentWeeks }) => (
                      <tr key={student.id} className="border-t border-foreground/8 hover:bg-foreground/3">
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={selectedCandidates.has(student.id)}
                            onChange={(e) => {
                              const s = new Set(selectedCandidates);
                              if (e.target.checked) s.add(student.id);
                              else s.delete(student.id);
                              setSelectedCandidates(s);
                            }}
                          />
                        </td>
                        <td className="px-4 py-2.5 font-medium">
                          <button
                            type="button"
                            onClick={() => { setShowCandidateModal(false); setHistoryStudent(student); }}
                            className="hover:underline underline-offset-2 text-left"
                          >
                            {student.name}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{student.grade} {student.class_num}</td>
                        <td className="px-4 py-2.5 text-xs">{student.guide ?? "—"}</td>
                        <td className="px-4 py-2.5 text-xs tabular-nums">
                          {lastAttendDate ? lastAttendDate.slice(5) : "기록 없음"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[10px] px-1.5 py-0.5 border border-[oklch(0.65_0.12_25)] text-[oklch(0.45_0.18_25)] bg-[oklch(0.97_0.02_25)]">
                            {absentWeeks}주+
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="px-6 py-4 border-t border-foreground/10 flex items-center justify-between gap-4">
              <div className="text-xs text-muted-foreground">
                {selectedCandidates.size > 0
                  ? `${selectedCandidates.size}명 선택됨`
                  : "체크박스로 선택 후 비활동 처리하세요"}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowCandidateModal(false)}>닫기</Button>
                <Button
                  size="sm"
                  disabled={selectedCandidates.size === 0 || processingBulk}
                  onClick={bulkSetInactive}
                  className="bg-[oklch(0.45_0.18_25)] text-white hover:bg-[oklch(0.38_0.18_25)]"
                >
                  {processingBulk ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
                  선택한 학생 비활동 처리
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 출석 이력 패널 */}
      <StudentHistoryPanel
        student={historyStudent}
        onClose={() => setHistoryStudent(null)}
        onStudentUpdate={(updated) => {
          setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
          setHistoryStudent(updated);
        }}
      />
    </AppLayout>
  );
}

// ── 서브 컴포넌트 ──────────────────────────────────────────────────────────

function ActiveCheckbox({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="block col-span-2">
      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">활동 여부</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={cn(
            "inline-block w-10 h-5 rounded-full transition-colors relative",
            value ? "bg-[oklch(0.32_0.05_250)]" : "bg-foreground/20",
          )}
        >
          <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-transform shadow-sm", value ? "translate-x-5" : "translate-x-0.5")} />
        </button>
        <span className="text-sm">{value ? "활동" : "비활동"}</span>
      </div>
    </label>
  );
}

function GenderSelect({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">성별</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-background border border-input rounded-md h-9 px-3 text-sm"
      >
        <option value="">선택하세요</option>
        <option value="남">남</option>
        <option value="여">여</option>
      </select>
    </label>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string | null; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</span>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function StudentTable({
  rows, canWrite, togglingId, onRowClick, onEdit, onDelete, onToggleActive,
}: {
  rows: Student[];
  canWrite: boolean;
  togglingId: string | null;
  onRowClick: (s: Student) => void;
  onEdit: (s: Student) => void;
  onDelete: (s: Student) => void;
  onToggleActive: (s: Student) => void;
}) {
  return (
    <div className="bg-white border border-foreground/10 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3">학년 · 반</th>
            <th className="px-4 py-3">이름</th>
            <th className="px-4 py-3">성별</th>
            <th className="px-4 py-3">학교</th>
              <th className="px-4 py-3">데려온 친구</th>
            <th className="px-4 py-3">연락처</th>
            <th className="px-4 py-3">활동</th>
            {canWrite && <th className="px-4 py-3 w-24" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr
              key={s.id}
              className={cn(
                "border-t border-foreground/10 cursor-pointer",
                s.is_active ? "hover:bg-[oklch(0.97_0.012_85)]" : "bg-foreground/2 text-foreground/50 hover:bg-foreground/4",
              )}
              onClick={() => onRowClick(s)}
            >
              <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{s.grade} {s.class_num}</td>
              <td className="px-4 py-2.5 font-medium">{s.name}</td>
              <td className="px-4 py-2.5 text-xs">{s.gender}</td>
              <td className="px-4 py-2.5 text-xs">{s.school}</td>
              <td className="px-4 py-2.5 text-xs">{s.guide}</td>
              <td className="px-4 py-2.5 text-xs tabular-nums">{s.phone}</td>
              <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                {canWrite ? (
                  <button
                    type="button"
                    onClick={() => onToggleActive(s)}
                    disabled={togglingId === s.id}
                    className={cn(
                      "inline-block w-9 h-5 rounded-full transition-colors relative",
                      s.is_active ? "bg-[oklch(0.32_0.05_250)]" : "bg-foreground/20",
                    )}
                    title={s.is_active ? "활동 → 비활동" : "비활동 → 활동"}
                  >
                    {togglingId === s.id ? (
                      <Loader2 className="absolute inset-0 m-auto size-3 animate-spin text-white" />
                    ) : (
                      <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-transform shadow-sm", s.is_active ? "translate-x-4" : "translate-x-0.5")} />
                    )}
                  </button>
                ) : (
                  <span className={cn(
                    "text-[10px] uppercase tracking-wider px-1.5 py-0.5 border",
                    s.is_active
                      ? "border-[oklch(0.75_0.08_250)] text-[oklch(0.32_0.05_250)] bg-[oklch(0.93_0.04_250)]"
                      : "border-foreground/20 text-muted-foreground bg-foreground/5",
                  )}>
                    {s.is_active ? "활동" : "비활동"}
                  </span>
                )}
              </td>
              {canWrite && (
                <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(s)}><Pencil className="size-3.5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(s)}><Trash2 className="size-3.5 text-destructive" /></Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="text-center text-muted-foreground text-sm py-12">결과가 없습니다.</div>
      )}
    </div>
  );
}

function TeacherTable({ rows, canWrite, onEdit, onDelete }: {
  rows: Teacher[];
  canWrite: boolean;
  onEdit: (t: Teacher) => void;
  onDelete: (t: Teacher) => void;
}) {
  return (
    <div className="bg-white border border-foreground/10 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3">역할</th>
            <th className="px-4 py-3">이름</th>
            {canWrite && <th className="px-4 py-3 w-24" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-t border-foreground/10 hover:bg-[oklch(0.97_0.012_85)]">
              <td className="px-4 py-2.5 text-xs">{t.role}</td>
              <td className="px-4 py-2.5 font-medium">{t.name}</td>
              {canWrite && (
                <td className="px-4 py-2.5 text-right">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(t)}><Pencil className="size-3.5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(t)}><Trash2 className="size-3.5 text-destructive" /></Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="text-center text-muted-foreground text-sm py-12">결과가 없습니다.</div>
      )}
    </div>
  );
}
