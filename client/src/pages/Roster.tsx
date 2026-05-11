// Devotional Editorial 스타일 - 명단 관리
// - 학생/교사 탭 전환
// - 인라인 편집 다이얼로그 (생성/수정/삭제)
// - CSV/XLSX 일괄 업로드 (헤더 자동 매핑)
import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase, type Student, type Teacher } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, type Profile } from "@/contexts/AuthContext";
import { Mail, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Upload, Download, UserCog } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type Tab = "students" | "teachers" | "users";

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
        </header>

        {/* Tabs + Search */}
        <div className="flex items-center justify-between mb-4 border-b border-foreground/15">
          <div className="flex">
            {(["students", "teachers", "users"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm uppercase tracking-wider border-b-2 -mb-px transition-colors ${
                  tab === t
                    ? "border-[oklch(0.32_0.05_250)] text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "students"
                  ? `학생 (${students.length})`
                  : t === "teachers"
                    ? `교사 (${teachers.length})`
                    : `사용자 계정`}
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
            onEdit={(s) => setEditing({ kind: "student", data: s })}
            onDelete={(s) => remove("students", s.id, s.name)}
          />
        ) : tab === "teachers" ? (
          <TeacherTable
            rows={filteredTeachers}
            onEdit={(t) => setEditing({ kind: "teacher", data: t })}
            onDelete={(t) => remove("teachers", t.id, t.name)}
          />
        ) : (
          <UsersPanel />
        )}
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
  onEdit,
  onDelete,
}: {
  rows: Student[];
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
            <th className="px-4 py-3 w-24" />
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
              <td className="px-4 py-2.5 text-right">
                <Button variant="ghost" size="icon" onClick={() => onEdit(s)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(s)}>
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </td>
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
  onEdit,
  onDelete,
}: {
  rows: Teacher[];
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
            <th className="px-4 py-3 w-24" />
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-t border-foreground/10 hover:bg-[oklch(0.97_0.012_85)]">
              <td className="px-4 py-2.5 text-xs">{t.role}</td>
              <td className="px-4 py-2.5 font-medium">{t.name}</td>
              <td className="px-4 py-2.5 text-right">
                <Button variant="ghost" size="icon" onClick={() => onEdit(t)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(t)}>
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </td>
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

// ── 관리자 사용자 패널 ────────────────────────────────────────────────────
function UsersPanel() {
  const { isAdmin, profile, session } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "teacher">("teacher");
  const [submitting, setSubmitting] = useState(false);

  async function reload() {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("불러오기 실패", { description: error.message });
    } else {
      setProfiles((data ?? []) as Profile[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  async function changeRole(p: Profile, next: "admin" | "teacher") {
    if (p.id === profile?.id && next !== "admin") {
      if (!confirm("자신의 관리자 권한을 해제하시겠습니까? 이후 이 화면에 다시 접근할 수 없습니다.")) {
        return;
      }
    }
    const prev = p.role;
    setProfiles((arr) => arr.map((x) => (x.id === p.id ? { ...x, role: next } : x)));
    const { error } = await supabase.from("profiles").update({ role: next }).eq("id", p.id);
    if (error) {
      setProfiles((arr) => arr.map((x) => (x.id === p.id ? { ...x, role: prev } : x)));
      toast.error("권한 변경 실패", { description: error.message });
    } else {
      toast.success(`${p.email} → ${next}`);
    }
  }

  async function invite(e: FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: inviteEmail.trim(),
          display_name: inviteName.trim() || null,
          role: inviteRole,
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success("초대 메일을 보냈습니다", { description: inviteEmail });
      setInviteEmail("");
      setInviteName("");
      setInviteRole("teacher");
      await reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("초대 실패", { description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  if (!session) {
    return (
      <div className="text-sm text-muted-foreground py-12 text-center">
        로그인 후 사용 가능합니다.
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="border border-foreground/15 bg-white p-6 max-w-lg">
        <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2">
          Admin only
        </div>
        <p className="text-sm leading-relaxed">
          이 영역은 관리자 권한을 가진 사용자만 사용할 수 있습니다.<br />
          현재 권한: <strong>{profile?.role ?? "unknown"}</strong>
        </p>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-8">
      {/* 사용자 목록 */}
      <div className="border border-foreground/15 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[oklch(0.95_0.012_85)] text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">이메일</th>
              <th className="text-left px-4 py-3">표시 이름</th>
              <th className="text-left px-4 py-3">권한</th>
              <th className="text-left px-4 py-3">가입일</th>
              <th className="px-4 py-3 w-32"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  <Loader2 className="inline animate-spin size-4 mr-2" />
                  불러오는 중…
                </td>
              </tr>
            )}
            {!loading &&
              profiles.map((p) => (
                <tr key={p.id} className="border-t border-foreground/10">
                  <td className="px-4 py-3 font-mono text-xs">{p.email}</td>
                  <td className="px-4 py-3">{p.display_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm ${
                        p.role === "admin"
                          ? "bg-[oklch(0.32_0.05_250)] text-white"
                          : "bg-foreground/10 text-foreground"
                      }`}
                    >
                      {p.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => changeRole(p, p.role === "admin" ? "teacher" : "admin")}
                      className="bg-white text-xs"
                    >
                      <UserCog className="size-3.5" />
                      {p.role === "admin" ? "교사로" : "관리자로"}
                    </Button>
                  </td>
                </tr>
              ))}
            {!loading && profiles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  등록된 사용자가 없습니다. 아래 폼으로 첫 사용자를 초대해 보세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 초대 폼 */}
      <aside className="border border-foreground/15 bg-white p-5 h-fit space-y-4">
        <div>
          <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2">
            Invite
          </div>
          <h3 className="font-display text-xl italic flex items-center gap-2">
            <Mail className="size-4" /> 사용자 초대
          </h3>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            이메일로 초대 링크를 발송합니다. 수신자는 링크 → 비밀번호 설정 후 즉시 로그인됩니다.
          </p>
        </div>
        <form onSubmit={invite} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="invemail" className="text-xs uppercase tracking-wider">
              Email
            </Label>
            <Input
              id="invemail"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invname" className="text-xs uppercase tracking-wider">
              Name (옵션)
            </Label>
            <Input
              id="invname"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              className="h-9"
              placeholder="홍길동"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider">Role</Label>
            <div className="flex gap-2">
              {(["teacher", "admin"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setInviteRole(r)}
                  className={`flex-1 text-xs uppercase tracking-wider px-3 py-2 border ${
                    inviteRole === r
                      ? "bg-[oklch(0.32_0.05_250)] text-white border-[oklch(0.32_0.05_250)]"
                      : "bg-white border-foreground/20"
                  }`}
                >
                  {r === "admin" ? (
                    <span className="flex items-center justify-center gap-1">
                      <ShieldCheck className="size-3.5" /> Admin
                    </span>
                  ) : (
                    "Teacher"
                  )}
                </button>
              ))}
            </div>
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full rounded-none h-10 bg-[oklch(0.32_0.05_250)] hover:bg-[oklch(0.28_0.05_250)] text-sm uppercase tracking-wider"
          >
            {submitting ? <Loader2 className="animate-spin size-4" /> : "초대 보내기"}
          </Button>
        </form>
      </aside>
    </div>
  );
}
