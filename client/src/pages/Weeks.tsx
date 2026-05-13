// - attendance_dates 테이블 CRUD
// - 날짜 목록, service_type/label 편집, is_active 토글
// - 해당 날짜의 attendance 입력 여부 표시
// - Devotional Editorial 톤 (잉크 블루 + 페이퍼 톤)
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useSelectedDate } from "@/contexts/SelectedDateContext";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { formatDateLabel } from "@/contexts/SelectedDateContext";

interface AttendanceDateRow {
  attendance_date: string;
  service_type: string;
  label: string | null;
  is_default_sunday: boolean;
  is_active: boolean;
  created_at: string;
  // 집계 (클라이언트 조인)
  attendance_count?: number;
}

const SERVICE_TYPES = ["주일예배", "특별예배", "수련회", "기타"];

export default function Weeks() {
  const { isAdmin } = useAuth();
  const { refreshDates } = useSelectedDate();
  const [rows, setRows] = useState<AttendanceDateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ service_type: string; label: string; is_active: boolean }>({
    service_type: "주일예배",
    label: "",
    is_active: true,
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ attendance_date: "", service_type: "주일예배", label: "" });
  const [saving, setSaving] = useState(false);
  const [showPast, setShowPast] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data: dates, error } = await supabase
      .from("attendance_dates")
      .select("*")
      .order("attendance_date", { ascending: false });
    if (error) { toast.error("날짜 목록 로드 실패"); setLoading(false); return; }

    // attendance 건수 집계
    const { data: counts } = await supabase
      .from("attendance")
      .select("attendance_date")
      .in("attendance_date", (dates || []).map((d: AttendanceDateRow) => d.attendance_date));

    const countMap = new Map<string, number>();
    (counts || []).forEach((r: { attendance_date: string }) => {
      countMap.set(r.attendance_date, (countMap.get(r.attendance_date) || 0) + 1);
    });

    const enriched = (dates || []).map((d: AttendanceDateRow) => ({
      ...d,
      attendance_count: countMap.get(d.attendance_date) || 0,
    }));
    setRows(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // 수정 시작
  function startEdit(row: AttendanceDateRow) {
    setEditingDate(row.attendance_date);
    setEditForm({
      service_type: row.service_type,
      label: row.label || "",
      is_active: row.is_active,
    });
  }

  // 수정 저장
  async function saveEdit(date: string) {
    setSaving(true);
    const { error } = await supabase
      .from("attendance_dates")
      .update({
        service_type: editForm.service_type,
        label: editForm.label.trim() || null,
        is_active: editForm.is_active,
      })
      .eq("attendance_date", date);
    setSaving(false);
    if (error) { toast.error("저장 실패: " + error.message); return; }
    toast.success("저장됨");
    setEditingDate(null);
    fetchRows();
    refreshDates();
  }

  // 활동 토글 (빠른 토글)
  async function toggleActive(row: AttendanceDateRow) {
    const next = !row.is_active;
    setRows((prev) => prev.map((r) => r.attendance_date === row.attendance_date ? { ...r, is_active: next } : r));
    const { error } = await supabase
      .from("attendance_dates")
      .update({ is_active: next })
      .eq("attendance_date", row.attendance_date);
    if (error) {
      toast.error("토글 실패");
      setRows((prev) => prev.map((r) => r.attendance_date === row.attendance_date ? { ...r, is_active: !next } : r));
    } else {
      refreshDates();
    }
  }

  // 삭제 (attendance 기록 없을 때만)
  async function deleteRow(row: AttendanceDateRow) {
    if ((row.attendance_count || 0) > 0) {
      toast.error(`출석 기록이 ${row.attendance_count}건 있어 삭제할 수 없습니다. 비활성화를 사용하세요.`);
      return;
    }
    if (!confirm(`${row.attendance_date} 날짜를 삭제하시겠습니까?`)) return;
    const { error } = await supabase
      .from("attendance_dates")
      .delete()
      .eq("attendance_date", row.attendance_date);
    if (error) { toast.error("삭제 실패: " + error.message); return; }
    toast.success("삭제됨");
    fetchRows();
    refreshDates();
  }

  // 날짜 추가
  async function addDate() {
    if (!addForm.attendance_date) { toast.error("날짜를 입력하세요"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("attendance_dates")
      .insert({
        attendance_date: addForm.attendance_date,
        service_type: addForm.service_type,
        label: addForm.label.trim() || null,
        is_default_sunday: new Date(addForm.attendance_date + "T00:00:00").getDay() === 0,
        is_active: true,
      });
    setSaving(false);
    if (error) { toast.error("추가 실패: " + error.message); return; }
    toast.success("날짜 추가됨");
    setShowAddForm(false);
    setAddForm({ attendance_date: "", service_type: "주일예배", label: "" });
    fetchRows();
    refreshDates();
  }

  // 표시 필터: 오늘 이전 날짜는 기본 숨김
  const upcomingRows = rows.filter((r) => r.attendance_date >= today);
  const pastRows = rows.filter((r) => r.attendance_date < today);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        관리자 권한이 필요합니다.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Admin · Weeks</p>
          <h1 className="text-3xl font-bold italic text-[oklch(0.22_0.04_250)]">주간 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            출석부에 표시될 날짜 목록을 관리합니다. 2026년 일요일 52주가 사전 등록되어 있습니다.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-1.5 text-sm px-3 py-2 bg-[oklch(0.22_0.04_250)] text-white hover:bg-[oklch(0.28_0.05_250)] transition-colors"
        >
          <Plus className="size-4" />
          날짜 추가
        </button>
      </div>

      {/* 추가 폼 */}
      {showAddForm && (
        <div className="mb-6 p-4 border border-[oklch(0.22_0.04_250)]/20 bg-[oklch(0.97_0.01_250)]">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">새 날짜 추가</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">날짜</label>
              <input
                type="date"
                value={addForm.attendance_date}
                onChange={(e) => setAddForm((f) => ({ ...f, attendance_date: e.target.value }))}
                className="text-sm px-2 py-1.5 border border-foreground/20 bg-white focus:outline-none focus:border-[oklch(0.32_0.05_250)] w-36"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">예배 종류</label>
              <select
                value={addForm.service_type}
                onChange={(e) => setAddForm((f) => ({ ...f, service_type: e.target.value }))}
                className="text-sm px-2 py-1.5 border border-foreground/20 bg-white focus:outline-none w-32"
              >
                {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">라벨 (선택)</label>
              <input
                type="text"
                value={addForm.label}
                onChange={(e) => setAddForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="예: 부활절, 성탄절"
                className="text-sm px-2 py-1.5 border border-foreground/20 bg-white focus:outline-none w-36"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={addDate}
                disabled={saving}
                className="flex items-center gap-1 text-sm px-3 py-1.5 bg-[oklch(0.22_0.04_250)] text-white hover:bg-[oklch(0.28_0.05_250)] disabled:opacity-50 transition-colors"
              >
                <Check className="size-3.5" /> 추가
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="flex items-center gap-1 text-sm px-3 py-1.5 border border-foreground/20 hover:bg-foreground/5 transition-colors"
              >
                <X className="size-3.5" /> 취소
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">로딩 중...</div>
      ) : (
        <>
          {/* 오늘 이후 (예정) */}
          <section className="mb-6">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
              <Calendar className="size-3" /> 예정 ({upcomingRows.length}주)
            </p>
            <WeekTable
              rows={upcomingRows}
              editingDate={editingDate}
              editForm={editForm}
              setEditForm={setEditForm}
              onStartEdit={startEdit}
              onSaveEdit={saveEdit}
              onCancelEdit={() => setEditingDate(null)}
              onToggleActive={toggleActive}
              onDelete={deleteRow}
              saving={saving}
            />
          </section>

          {/* 과거 날짜 (접기/펼치기) */}
          <section>
            <button
              onClick={() => setShowPast((v) => !v)}
              className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground mb-3 hover:text-foreground transition-colors"
            >
              {showPast ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              과거 기록 ({pastRows.length}주)
            </button>
            {showPast && (
              <WeekTable
                rows={pastRows}
                editingDate={editingDate}
                editForm={editForm}
                setEditForm={setEditForm}
                onStartEdit={startEdit}
                onSaveEdit={saveEdit}
                onCancelEdit={() => setEditingDate(null)}
                onToggleActive={toggleActive}
                onDelete={deleteRow}
                saving={saving}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ── WeekTable 서브 컴포넌트 ──────────────────────────────────

interface WeekTableProps {
  rows: AttendanceDateRow[];
  editingDate: string | null;
  editForm: { service_type: string; label: string; is_active: boolean };
  setEditForm: React.Dispatch<React.SetStateAction<{ service_type: string; label: string; is_active: boolean }>>;
  onStartEdit: (row: AttendanceDateRow) => void;
  onSaveEdit: (date: string) => void;
  onCancelEdit: () => void;
  onToggleActive: (row: AttendanceDateRow) => void;
  onDelete: (row: AttendanceDateRow) => void;
  saving: boolean;
}

function WeekTable({
  rows, editingDate, editForm, setEditForm,
  onStartEdit, onSaveEdit, onCancelEdit, onToggleActive, onDelete, saving,
}: WeekTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">항목 없음</p>;
  }

  return (
    <div className="border border-foreground/10 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[oklch(0.22_0.04_250)] text-white">
            <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider font-medium w-36">날짜</th>
            <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider font-medium w-28">예배 종류</th>
            <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider font-medium">라벨</th>
            <th className="text-center px-3 py-2 text-[10px] uppercase tracking-wider font-medium w-16">활동</th>
            <th className="text-center px-3 py-2 text-[10px] uppercase tracking-wider font-medium w-20">출석 입력</th>
            <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider font-medium w-20">작업</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isEditing = editingDate === row.attendance_date;
            const hasAttendance = (row.attendance_count || 0) > 0;
            return (
              <tr
                key={row.attendance_date}
                className={`border-t border-foreground/5 ${
                  i % 2 === 0 ? "bg-white" : "bg-[oklch(0.98_0.005_250)]"
                } ${!row.is_active ? "opacity-50" : ""}`}
              >
                {/* 날짜 */}
                <td className="px-3 py-2 tabular-nums text-xs font-mono">
                  <span className={row.is_default_sunday ? "" : "text-amber-600"}>
                    {formatDateLabel(row.attendance_date)}
                  </span>
                </td>

                {/* 예배 종류 */}
                <td className="px-3 py-2">
                  {isEditing ? (
                    <select
                      value={editForm.service_type}
                      onChange={(e) => setEditForm((f) => ({ ...f, service_type: e.target.value }))}
                      className="text-xs px-1.5 py-1 border border-foreground/20 bg-white focus:outline-none w-full"
                    >
                      {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : (
                    <span className={`text-xs ${row.service_type !== "주일예배" ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                      {row.service_type}
                    </span>
                  )}
                </td>

                {/* 라벨 */}
                <td className="px-3 py-2">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.label}
                      onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                      placeholder="예: 부활절"
                      className="text-xs px-1.5 py-1 border border-foreground/20 bg-white focus:outline-none w-full"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">{row.label || "—"}</span>
                  )}
                </td>

                {/* 활동 토글 */}
                <td className="px-3 py-2 text-center">
                  {isEditing ? (
                    <button
                      onClick={() => setEditForm((f) => ({ ...f, is_active: !f.is_active }))}
                      className={`text-xs px-2 py-0.5 border transition-colors ${
                        editForm.is_active
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-foreground/15 text-muted-foreground"
                      }`}
                    >
                      {editForm.is_active ? "활동" : "비활동"}
                    </button>
                  ) : (
                    <button
                      onClick={() => onToggleActive(row)}
                      className={`text-xs px-2 py-0.5 border transition-colors ${
                        row.is_active
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-foreground/15 text-muted-foreground hover:bg-foreground/5"
                      }`}
                    >
                      {row.is_active ? "활동" : "비활동"}
                    </button>
                  )}
                </td>

                {/* 출석 입력 여부 */}
                <td className="px-3 py-2 text-center">
                  {hasAttendance ? (
                    <span className="text-xs text-[oklch(0.32_0.05_250)] font-medium">
                      {row.attendance_count}건
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">미입력</span>
                  )}
                </td>

                {/* 작업 버튼 */}
                <td className="px-3 py-2 text-right">
                  {isEditing ? (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onSaveEdit(row.attendance_date)}
                        disabled={saving}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 transition-colors"
                        title="저장"
                      >
                        <Check className="size-3.5" />
                      </button>
                      <button
                        onClick={onCancelEdit}
                        className="p-1 text-muted-foreground hover:bg-foreground/5 transition-colors"
                        title="취소"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onStartEdit(row)}
                        className="p-1 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                        title="수정"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(row)}
                        disabled={hasAttendance}
                        className="p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title={hasAttendance ? "출석 기록이 있어 삭제 불가 (비활성화 사용)" : "삭제"}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
