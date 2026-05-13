// GuestPromoteModal.tsx - 손님 → 정규 학생 승격 모달 (M4-22)
// - 이름/학년/반/성별/데려온 친구(guide) 확인 → students INSERT
// - guests.is_promoted=true, promoted_student_id=새 학생 ID
// - guest_attendance 이력을 새 student_id의 attendance 레코드로 소급 이전
// - inviter_student_id가 있으면 새 학생의 guide(데려온 친구) 필드로 자동 복사
// - Devotional Editorial 톤 (잉크 블루 + 페이퍼 톤)
import { useEffect, useState } from "react";
import { supabase, type Guest, type Student, type GuestAttendance } from "@/lib/supabase";
import { toast } from "sonner";
import { X, Check, Loader2, Sparkles } from "lucide-react";

interface GuestPromoteModalProps {
  guest: Guest | null;
  students: Student[];
  onClose: () => void;
  onPromoted: (guest: Guest, newStudent: Student) => void;
}

const GRADE_OPTIONS = ["1학년", "2학년", "3학년"];
const CLASS_OPTIONS = ["1반", "2반", "3반", "4반", "5반"];

export function GuestPromoteModal({ guest, students, onClose, onPromoted }: GuestPromoteModalProps) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("1학년");
  const [classNum, setClassNum] = useState("1반");
  const [gender, setGender] = useState<string>("");
  const [inviterId, setInviterId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (guest) {
      setName(guest.name);
      // 손님이 grade/class_num을 숫자로 가지고 있다면 문자열로 변환
      setGrade(guest.grade ? `${guest.grade}학년` : "1학년");
      setClassNum(guest.class_num ? `${guest.class_num}반` : "1반");
      setGender(guest.gender || "");
      setInviterId(guest.inviter_student_id || "");
    }
  }, [guest]);

  if (!guest) return null;

  const inviter = inviterId ? students.find((s) => s.id === inviterId) : null;

  async function promote() {
    if (!guest) return;
    if (!name.trim()) { toast.error("이름은 필수입니다"); return; }
    setSaving(true);

    // 1) students INSERT
    const { data: newStudent, error: insertError } = await supabase
      .from("students")
      .insert({
        name: name.trim(),
        grade,
        class_num: classNum,
        gender: gender || null,
        guide: inviter ? inviter.name : null, // inviter.name → guide 필드 자동 복사
        is_active: true,
      })
      .select()
      .single();

    if (insertError || !newStudent) {
      setSaving(false);
      toast.error("학생 등록 실패: " + (insertError?.message || "unknown"));
      return;
    }

    // 2) guest의 모든 출석 이력 → attendance로 소급 이전
    const { data: gaList } = await supabase
      .from("guest_attendance")
      .select("*")
      .eq("guest_id", guest.id);

    if (gaList && gaList.length > 0) {
      const attRows = (gaList as GuestAttendance[]).map((ga) => ({
        student_id: (newStudent as Student).id,
        attendance_date: ga.attend_date,
        status: ga.status,
      }));
      const { error: attError } = await supabase
        .from("attendance")
        .upsert(attRows, { onConflict: "student_id,attendance_date" });
      if (attError) {
        toast.warning(`학생 등록 완료 / 출석 이력 ${gaList.length}건 이전 일부 실패: ${attError.message}`);
      }
      // 이전된 guest_attendance 삭제
      await supabase.from("guest_attendance").delete().eq("guest_id", guest.id);
    }

    // 3) guests.is_promoted=true, promoted_student_id 연결
    const { error: updateError } = await supabase
      .from("guests")
      .update({
        is_promoted: true,
        promoted_student_id: (newStudent as Student).id,
      })
      .eq("id", guest.id);

    setSaving(false);
    if (updateError) {
      toast.warning("학생 등록 완료 / 손님 상태 갱신 실패: " + updateError.message);
    }

    onPromoted({ ...guest, is_promoted: true, promoted_student_id: (newStudent as Student).id }, newStudent as Student);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-[oklch(0.98_0.01_85)] border border-foreground/15 max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-foreground/10 bg-rose-50/40">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-rose-600" />
            <h2 className="font-display text-lg italic text-[oklch(0.32_0.05_250)]">정규 학생으로 승격</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            이 손님을 정규 학생으로 등록합니다. 등록 시 손님 출석 이력이 새 학생으로 소급 이전됩니다.
          </p>

          {/* 이름 */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">이름 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm px-2 py-1.5 border border-foreground/20 bg-white focus:outline-none focus:border-[oklch(0.32_0.05_250)]"
            />
          </div>

          {/* 학년 / 반 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">학년</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full text-sm px-2 py-1.5 border border-foreground/20 bg-white focus:outline-none"
              >
                {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">반</label>
              <select
                value={classNum}
                onChange={(e) => setClassNum(e.target.value)}
                className="w-full text-sm px-2 py-1.5 border border-foreground/20 bg-white focus:outline-none"
              >
                {CLASS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* 성별 */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">성별</label>
            <div className="flex gap-2">
              {["남", "여"].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(gender === g ? "" : g)}
                  className={`text-sm px-3 py-1 border transition-colors ${
                    gender === g ? "border-[oklch(0.32_0.05_250)] bg-[oklch(0.95_0.02_250)] text-[oklch(0.32_0.05_250)]" : "border-foreground/15 text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* 데려온 친구 (inviter) */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">데려온 친구 (선택)</label>
            <select
              value={inviterId}
              onChange={(e) => setInviterId(e.target.value)}
              className="w-full text-sm px-2 py-1.5 border border-foreground/20 bg-white focus:outline-none"
            >
              <option value="">— 없음 —</option>
              {students
                .filter((s) => s.is_active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.grade} {s.class_num} {s.name}
                  </option>
                ))}
            </select>
            {inviter && (
              <p className="text-[10px] text-muted-foreground mt-1">
                · 새 학생의 '데려온 친구' 필드에 "{inviter.name}"이(가) 자동 입력됩니다
              </p>
            )}
          </div>

          {/* 액션 */}
          <div className="flex justify-end gap-2 pt-2 border-t border-foreground/10">
            <button
              onClick={onClose}
              disabled={saving}
              className="text-sm px-3 py-1.5 border border-foreground/20 hover:bg-foreground/5 disabled:opacity-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={promote}
              disabled={saving || !name.trim()}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-[oklch(0.32_0.05_250)] text-white hover:bg-[oklch(0.28_0.05_250)] disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              정규 학생으로 등록
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
