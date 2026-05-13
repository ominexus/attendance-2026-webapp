// GuestAddModal.tsx - 친구초청 손님 추가 모달 (M4-22)
// - 이름 (필수), 데려온 학생 (옵션), 성별/학년/반 (옵션)
// - guests INSERT + guest_attendance INSERT (자동 출석 체크)
// - Devotional Editorial 톤
import { useState } from "react";
import { supabase, type Guest, type Student } from "@/lib/supabase";
import { toast } from "sonner";
import { X, Check, Loader2, UserPlus } from "lucide-react";

interface GuestAddModalProps {
  open: boolean;
  attendDate: string; // YYYY-MM-DD (현재 선택된 일요일)
  students: Student[];
  autoCheckAttendance: boolean; // true이면 추가 시 즉시 출석 체크
  onClose: () => void;
  onAdded: (guest: Guest) => void;
}

const GRADE_OPTIONS = ["", "1학년", "2학년", "3학년"];
const CLASS_OPTIONS = ["", "1반", "2반", "3반", "4반", "5반"];

export function GuestAddModal({ open, attendDate, students, autoCheckAttendance, onClose, onAdded }: GuestAddModalProps) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [classNum, setClassNum] = useState("");
  const [gender, setGender] = useState("");
  const [inviterId, setInviterId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  function reset() {
    setName(""); setGrade(""); setClassNum(""); setGender(""); setInviterId(""); setNote("");
  }

  async function add() {
    if (!name.trim()) { toast.error("이름은 필수입니다"); return; }
    setSaving(true);

    // grade 문자열 → 숫자 추출 (옵션)
    const gradeNum = grade ? parseInt(grade.replace(/[^0-9]/g, ""), 10) : null;
    const classNumber = classNum ? parseInt(classNum.replace(/[^0-9]/g, ""), 10) : null;

    const { data: newGuest, error } = await supabase
      .from("guests")
      .insert({
        name: name.trim(),
        gender: gender || null,
        grade: gradeNum,
        class_num: classNumber,
        inviter_student_id: inviterId || null,
        first_visit_date: attendDate,
        note: note.trim() || null,
      })
      .select()
      .single();

    if (error || !newGuest) {
      setSaving(false);
      toast.error("손님 추가 실패: " + (error?.message || "unknown"));
      return;
    }

    // 자동 출석 체크
    if (autoCheckAttendance) {
      const { error: gaError } = await supabase
        .from("guest_attendance")
        .insert({ guest_id: (newGuest as Guest).id, attend_date: attendDate, status: true });
      if (gaError) {
        toast.warning("손님 등록 완료 / 출석 체크 실패: " + gaError.message);
      }
    }

    setSaving(false);
    toast.success(`'${name.trim()}' 손님 추가됨`);
    reset();
    onAdded(newGuest as Guest);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-[oklch(0.98_0.01_85)] border border-foreground/15 max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-foreground/10 bg-rose-50/40">
          <div className="flex items-center gap-2">
            <UserPlus className="size-4 text-rose-600" />
            <h2 className="font-display text-lg italic text-[oklch(0.32_0.05_250)]">초청 손님 추가</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground">{attendDate} 손님을 추가합니다. 이름만 필수, 나머지는 선택입니다.</p>

          {/* 이름 */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">이름 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="손님 이름"
              className="w-full text-sm px-2 py-1.5 border border-foreground/20 bg-white focus:outline-none focus:border-[oklch(0.32_0.05_250)]"
            />
          </div>

          {/* 데려온 학생 */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">데려온 학생 (선택)</label>
            <select
              value={inviterId}
              onChange={(e) => setInviterId(e.target.value)}
              className="w-full text-sm px-2 py-1.5 border border-foreground/20 bg-white focus:outline-none"
            >
              <option value="">— 선택 안 함 —</option>
              {students
                .filter((s) => s.is_active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.grade} {s.class_num} {s.name}
                  </option>
                ))}
            </select>
          </div>

          {/* 학년 / 반 / 성별 */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">학년</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full text-sm px-2 py-1.5 border border-foreground/20 bg-white focus:outline-none"
              >
                {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g || "—"}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">반</label>
              <select
                value={classNum}
                onChange={(e) => setClassNum(e.target.value)}
                className="w-full text-sm px-2 py-1.5 border border-foreground/20 bg-white focus:outline-none"
              >
                {CLASS_OPTIONS.map((c) => <option key={c} value={c}>{c || "—"}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">성별</label>
              <div className="flex gap-1">
                {["남", "여"].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(gender === g ? "" : g)}
                    className={`flex-1 text-sm py-1 border transition-colors ${
                      gender === g ? "border-[oklch(0.32_0.05_250)] bg-[oklch(0.95_0.02_250)] text-[oklch(0.32_0.05_250)]" : "border-foreground/15 text-muted-foreground hover:border-foreground/30"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">메모 (선택)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="예: ○○ 학교, 첫 방문"
              className="w-full text-sm px-2 py-1.5 border border-foreground/20 bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-foreground/10">
            <p className="text-[10px] text-muted-foreground">
              {autoCheckAttendance ? "추가 즉시 출석 체크됩니다" : "출석 체크는 별도로 진행하세요"}
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={saving}
                className="text-sm px-3 py-1.5 border border-foreground/20 hover:bg-foreground/5 disabled:opacity-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={add}
                disabled={saving || !name.trim()}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-[oklch(0.32_0.05_250)] text-white hover:bg-[oklch(0.28_0.05_250)] disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                추가
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
