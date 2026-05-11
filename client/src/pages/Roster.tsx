// Devotional Editorial 스타일 - 명단 관리
// - 학생/교사 탭 전환
// - 인라인 편집 다이얼로그 (생성/수정/삭제)
// - CSV/XLSX 일괄 업로드 (헤더 자동 매핑)
import { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase, type Student, type Teacher } from "@/lib/supabase";
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
import { Loader2, Plus, Pencil, Trash2, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type Tab = "students" | "teachers";

const STUDENT_FIELDS: Array<keyof Student> = [
  "grade",
  "class_num",
  "name",
  "gender",
  "phone",
  "birth_date",
  "school",
  "guide",
];
const STUDENT_LABELS: Record<string, string> = {
  grade: "학년",
  class_num: "반",
  name: "이름",
  gender: "성별",
  phone: "연락처",
  birth_date: "생년월일",
  school: "학교",
  guide: "지도교사",
};

export default function Roster() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>("students");
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<
    | { kind: "student"; data: Partial<Student> }
    | { kind: "teacher"; data: Partial<Teacher> }
    | null
  >(null);
  const [keyword, setKeyword] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function reload() {
    setLoading(true);
    const [{ data: s }, { data: t }] = await Promise.all([
      supabase.from("students").select("*").order("grade").order("class_num").order("name"),
      supabase.from("teachers").select("*").order("role").order("name"),
    ]);
    setStudents((s as Student[]) ?? []);
    setTeachers((t as Teacher[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  const filteredStudents = useMemo(
    () =>
      keyword
        ? students.filter((s) =>
            [s.name, s.grade, s.class_num, s.school, s.guide]
              .filter(Boolean)
              .some((v) => String(v).includes(keyword)),
          )
        : students,
    [students, keyword],
  );
  const filteredTeachers = useMemo(
    () =>
      keyword
        ? teachers.filter((t) => [t.name, t.role].some((v) => v?.includes(keyword)))
        : teachers,
    [teachers, keyword],
  );

  async function save() {
    if (!editing) return;
    const { kind, data } = editing;
    const table = kind === "student" ? "students" : "teachers";
    const payload = { ...data };
    delete (payload as { created_at?: string }).created_at;

    const { error } = data.id
      ? await supabase.from(table).update(payload).eq("id", data.id)
      : await supabase.from(table).insert(payload);

    if (error) {
      toast.error("저장 실패: " + error.message);
    } else {
      toast.success("저장되었습니다");
      setEditing(null);
      reload();
    }
  }

  async function remove(kind: Tab, id: string, label: string) {
    if (!confirm(`${label} 항목을 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from(kind).delete().eq("id", id);
    if (error) toast.error("삭제 실패: " + error.message);
    else {
      toast.success("삭제되었습니다");
      reload();
    }
  }

  async function bulkUpload(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
      if (rows.length === 0) {
        toast.error("빈 파일입니다");
        return;
      }
      // 헤더 자동 매핑 (한글 → 영문 키)
      const reverseLabel: Record<string, string> = {};
      for (const [k, v] of Object.entries(STUDENT_LABELS)) reverseLabel[v] = k;

      const records = rows.map((r) => {
        const obj: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) {
          const key = reverseLabel[k] || k;
          obj[key] = v === "" ? null : v;
        }
        return obj;
      });

      const table = tab === "students" ? "students" : "teachers";
      const { error } = await supabase.from(table).insert(records);
      if (error) {
        toast.error("일괄 등록 실패: " + error.message);
      } else {
        toast.success(`${records.length}건 등록 완료`);
        reload();
      }
    } catch (e) {
      toast.error("파싱 오류: " + (e as Error).message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function downloadTemplate() {
    const headers =
      tab === "students"
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
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
              Roster Management
            </div>
            <h1 className="font-display text-4xl italic mt-1">명단 관리</h1>
          </div>

          {isAdmin && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="bg-white"
              >
                <Download className="size-3.5" />
                템플릿
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="bg-white"
              >
                <Upload className="size-3.5" />
                일괄 등록
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
                      ? { kind: "student", data: { grade: "1학년", class_num: "1반" } }
                      : { kind: "teacher", data: { role: "교사" } },
                  )
                }
                className="bg-[oklch(0.32_0.05_250)] text-white hover:bg-[oklch(0.28_0.05_250)]"
              >
                <Plus className="size-3.5" />
                추가
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

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="animate-spin size-4" />
            불러오는 중…
          </div>
        ) : tab === "students" ? (
          <StudentTable
            rows={filteredStudents}
            canWrite={isAdmin}
            onEdit={(s) => setEditing({ kind: "student", data: s })}
            onDelete={(s) => remove("students", s.id, s.name)}
          />
        ) : tab === "teachers" ? (
          <TeacherTable
            rows={filteredTeachers}
            canWrite={isAdmin}
            onEdit={(t) => setEditing({ kind: "teacher", data: t })}
            onDelete={(t) => remove("teachers", t.id, t.name)}
          />
        ) : null}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display italic text-xl">
              {editing?.data.id ? "편집" : "추가"} ·{" "}
              {editing?.kind === "student" ? "학생" : "교사"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            {editing?.kind === "student" &&
              STUDENT_FIELDS.map((f) => (
                <Field
                  key={f}
                  label={STUDENT_LABELS[f as string] ?? f}
                  value={(editing.data as Record<string, unknown>)[f as string] as string | null}
                  onChange={(v) =>
                    setEditing({
                      kind: "student",
                      data: { ...editing.data, [f]: v },
                    })
                  }
                  type={f === "birth_date" ? "date" : "text"}
                />
              ))}
            {editing?.kind === "teacher" && (
              <>
                <Field
                  label="역할"
                  value={editing.data.role ?? ""}
                  onChange={(v) =>
                    setEditing({ kind: "teacher", data: { ...editing.data, role: v } })
                  }
                />
                <Field
                  label="이름"
                  value={editing.data.name ?? ""}
                  onChange={(v) =>
                    setEditing({ kind: "teacher", data: { ...editing.data, name: v } })
                  }
                />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              취소
            </Button>
            <Button
              onClick={save}
              className="bg-[oklch(0.32_0.05_250)] text-white hover:bg-[oklch(0.28_0.05_250)]"
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </span>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function StudentTable({
  rows,
  canWrite,
  onEdit,
  onDelete,
}: {
  rows: Student[];
  canWrite: boolean;
  onEdit: (s: Student) => void;
  onDelete: (s: Student) => void;
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
            <th className="px-4 py-3">지도교사</th>
            <th className="px-4 py-3">연락처</th>
            {canWrite && <th className="px-4 py-3 w-24" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-t border-foreground/10 hover:bg-[oklch(0.97_0.012_85)]">
              <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                {s.grade} {s.class_num}
              </td>
              <td className="px-4 py-2.5 font-medium">{s.name}</td>
              <td className="px-4 py-2.5 text-xs">{s.gender}</td>
              <td className="px-4 py-2.5 text-xs">{s.school}</td>
              <td className="px-4 py-2.5 text-xs">{s.guide}</td>
              <td className="px-4 py-2.5 text-xs tabular-nums">{s.phone}</td>
              {canWrite && (
              <td className="px-4 py-2.5 text-right">
                <Button variant="ghost" size="icon" onClick={() => onEdit(s)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(s)}>
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
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

function TeacherTable({
  rows,
  canWrite,
  onEdit,
  onDelete,
}: {
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
                <Button variant="ghost" size="icon" onClick={() => onEdit(t)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(t)}>
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
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
