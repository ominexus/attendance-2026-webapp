// Devotional Editorial 스타일: paper-tone 배경, ink-blue 액센트
// 마일스톤 3 - 출석 입력 페이지
// 마일스톤 4-6: 반별 → 남/여 그룹핑
// 마일스톤 4-7: 행동 지표 (출석·결석·메모) 헤더
// 마일스톤 4-8: is_active 활동학생 필터링 + 자동 승격
// 마일스톤 4-9: 학생 카드 이름 클릭 → 출석 이력 패널 연동
//              카드 배경 클릭 → 출석 토글 (기존 동작 유지)
import { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase, type Student, type Attendance, type AbsenceNote, type Guest, type GuestAttendance } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSelectedDate, toSunday } from "@/contexts/SelectedDateContext";
import { DateSpinner } from "@/components/DateSpinner";
import { Loader2, Eye, MessageSquare, Check, Sparkles, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StudentHistoryPanel } from "@/components/StudentHistoryPanel";
import { GuestPromoteModal } from "@/components/GuestPromoteModal";
import { GuestAddModal } from "@/components/GuestAddModal";
import { loadHomeAttendanceData } from "@/lib/homeAttendanceLoader";

function normalizeGender(g: string | null): "남" | "여" | "미지정" {
  if (!g) return "미지정";
  const v = g.trim().toLowerCase();
  if (v === "남" || v === "m" || v === "male" || v === "boy") return "남";
  if (v === "여" || v === "f" || v === "female" || v === "girl") return "여";
  return "미지정";
}

interface GenderGroup {
  gender: "남" | "여" | "미지정";
  students: Student[];
}
interface ClassGroup {
  classKey: string;
  grade: string;
  classNum: string;
  genderGroups: GenderGroup[];
}

export default function Home() {
  const { isAdmin, user, profile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Map<string, Attendance>>(new Map());
  const [notes, setNotes] = useState<Map<string, AbsenceNote>>(new Map());
  const { selectedDate, refreshDates, dateEntries } = useSelectedDate();
  // Home은 일요일 단위 운영 - 선택 날짜를 일요일로 보정해서 사용
  const date = toSunday(selectedDate);
  const currentDateEntry = dateEntries.get(date);
  const [gradeFilter, setGradeFilter] = useState<string>("ALL");
  const [classFilter, setClassFilter] = useState<string>("ALL");
  const [showInactive, setShowInactive] = useState<boolean>(false);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [openNoteFor, setOpenNoteFor] = useState<string | null>(null);
  // 이력 패널
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);
  // M4-22: 새친구 관리
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestAttendance, setGuestAttendance] = useState<Map<string, GuestAttendance>>(new Map());
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [promoteGuest, setPromoteGuest] = useState<Guest | null>(null);
  const [savingGuest, setSavingGuest] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      console.log("[Home] Effect mount. Auth state:", { 
        isAdmin, 
        userId: user?.id, 
        hasProfile: !!profile,
        authLoading
      });

      // Give auth a moment to settle if needed
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cancelled) return;

      console.log("[Home] Fetching students...");
      try {
        const { data, error } = await supabase
          .from("students")
          .select("*")
          .order("grade")
          .order("class_num")
          .order("name");
        
        if (cancelled) return;
        if (error) {
          console.error("[Home] Student fetch error:", error);
          toast.error("학생 명단 로드 실패: " + error.message);
        } else {
          const studentList = (data as Student[]) ?? [];
          console.log(`[Home] Loaded ${studentList.length} students`);
          setStudents(studentList);
        }
      } catch (err) {
        console.error("[Home] Student fetch exception:", err);
        toast.error("학생 명단 로드 중 예외 발생");
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin, user?.id, profile, authLoading]); // Added dependencies to re-run if auth state changes significantly during mount

  useEffect(() => {
    let cancelled = false;
    setFetching(true);
    (async () => {
      try {
        const result = await loadHomeAttendanceData(date, {
          attendance: () => supabase.from("attendance").select("*").eq("attendance_date", date),
          notes: () => supabase.from("absence_notes").select("*").eq("attend_date", date),
          guests: () => supabase.from("guests").select("*").eq("is_promoted", false).order("created_at", { ascending: true }),
          guestAttendance: () => supabase.from("guest_attendance").select("*").eq("attend_date", date),
        });

        if (cancelled) return;
        setAttendance(result.attendance);
        setNotes(result.notes);
        setGuests(result.guests);
        setGuestAttendance(result.guestAttendance);

        for (const error of result.errors) {
          toast.error(`${error.label} 로드 실패: ${error.message}`);
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [date]);

  // M4-22: 새친구 출석 도장 토글
  async function toggleGuestAttendance(guest: Guest) {
    if (!isAdmin) {
      toast.error("관리자 권한이 필요합니다");
      return;
    }
    const current = guestAttendance.get(guest.id);
    const next = !current?.status;
    setSavingGuest((p) => new Set(p).add(guest.id));
    setGuestAttendance((prev) => {
      const m = new Map(prev);
      if (current) m.set(guest.id, { ...current, status: next });
      else m.set(guest.id, { id: "tmp-" + guest.id, guest_id: guest.id, attend_date: date, status: next, created_at: new Date().toISOString() });
      return m;
    });
    const { error, data } = await supabase
      .from("guest_attendance")
      .upsert({ guest_id: guest.id, attend_date: date, status: next }, { onConflict: "guest_id,attend_date" })
      .select()
      .single();
    if (error) {
      setGuestAttendance((prev) => {
        const m = new Map(prev);
        if (current) m.set(guest.id, current);
        else m.delete(guest.id);
        return m;
      });
      toast.error(`새친구 체크 실패: ${error.message}`);
    } else if (data) {
      setGuestAttendance((prev) => new Map(prev).set(guest.id, data as GuestAttendance));
    }
    setSavingGuest((p) => { const s = new Set(p); s.delete(guest.id); return s; });
  }

  // M4-22: 새친구 삭제 (admin only)
  async function deleteGuest(guest: Guest) {
    if (!isAdmin) return;
    if (!confirm(`'${guest.name}' 새친구를 삭제하시겠습니까?\n\u00b7 이 새친구의 출석 이력도 함께 삭제됩니다`)) return;
    const { error } = await supabase.from("guests").delete().eq("id", guest.id);
    if (error) { toast.error("삭제 실패: " + error.message); return; }
    setGuests((prev) => prev.filter((g) => g.id !== guest.id));
    setGuestAttendance((prev) => { const m = new Map(prev); m.delete(guest.id); return m; });
    toast.success(`'${guest.name}' 새친구 삭제됨`);
  }

  // M4-22: 승격 완료 콜백
  async function handlePromoted(promoted: Guest, newStudent: Student) {
    setGuests((prev) => prev.filter((g) => g.id !== promoted.id));
    setStudents((prev) => [...prev, newStudent]);
    setPromoteGuest(null);
    // 이 날짜의 새친구 출석 이력은 이미 소급 이전되어 student_id 출석으로 존재
    const ga = guestAttendance.get(promoted.id);
    if (ga) {
      // 출석 맵에서 제거하고 새 student_id 출석으로 대체 (아래 attendance 재조회로 표시)
      setGuestAttendance((prev) => { const m = new Map(prev); m.delete(promoted.id); return m; });
    }
    // 해당 날짜 출석 다시 로드 (소급 이전된 attendance 반영)
    const { data: attData } = await supabase.from("attendance").select("*").eq("attendance_date", date);
    if (attData) {
      const m = new Map<string, Attendance>();
      for (const a of attData as Attendance[]) m.set(a.student_id, a);
      setAttendance(m);
    }
    toast.success(`'${newStudent.name}' 정규 학생으로 승격됨 (고이력 소급 연결 완료)`);
  }

  const grades = useMemo(
    () => Array.from(new Set(students.map((s) => s.grade))).sort(),
    [students],
  );
  const classes = useMemo(
    () =>
      Array.from(
        new Set(
          students
            .filter((s) => gradeFilter === "ALL" || s.grade === gradeFilter)
            .map((s) => s.class_num),
        ),
      ).sort(),
    [students, gradeFilter],
  );

  const filtered = students.filter((s) => {
    if (!isAdmin && !s.is_active) return false;
    if (isAdmin && !showInactive && !s.is_active) return false;
    if (gradeFilter !== "ALL" && s.grade !== gradeFilter) return false;
    if (classFilter !== "ALL" && s.class_num !== classFilter) return false;
    return true;
  });

  const classGroups = useMemo<ClassGroup[]>(() => {
    const classKeys = Array.from(
      new Set(filtered.map((s) => `${s.grade}||${s.class_num}`)),
    ).sort();
    return classKeys.map((key) => {
      const [grade, classNum] = key.split("||");
      const classStudents = filtered.filter(
        (s) => s.grade === grade && s.class_num === classNum,
      );
      const genderOrder: ("남" | "여" | "미지정")[] = ["남", "여", "미지정"];
      const genderGroups: GenderGroup[] = genderOrder
        .map((gender) => ({
          gender,
          students: classStudents.filter((s) => normalizeGender(s.gender) === gender),
        }))
        .filter((g) => g.students.length > 0);
      return { classKey: key, grade, classNum, genderGroups };
    });
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(student: Student) {
    if (!isAdmin) {
            toast.error("입력 권한이 없습니다", {
              description: "관리자 권한이 필요합니다.",
            });
      return;
    }
    const current = attendance.get(student.id);
    const next = !current?.status;
    const willPromote = !student.is_active && next === true;

    setSaving((prev) => new Set(prev).add(student.id));

    setAttendance((prev) => {
      const m = new Map(prev);
      if (current) m.set(student.id, { ...current, status: next });
      else m.set(student.id, {
        id: "tmp-" + student.id,
        student_id: student.id,
        attendance_date: date,
        status: next,
        created_at: new Date().toISOString(),
      });
      return m;
    });

    if (willPromote) {
      setStudents((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, is_active: true } : s)),
      );
    }

    const { error: attError, data: attData } = await supabase
      .from("attendance")
      .upsert(
        { student_id: student.id, attendance_date: date, status: next },
        { onConflict: "student_id,attendance_date" },
      )
      .select()
      .single();

    if (attError) {
      setAttendance((prev) => {
        const m = new Map(prev);
        if (current) m.set(student.id, current);
        else m.delete(student.id);
        return m;
      });
      if (willPromote) setStudents((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, is_active: false } : s)),
      );
      toast.error(`${student.name} 저장 실패: ${attError.message}`);
      setSaving((prev) => { const s = new Set(prev); s.delete(student.id); return s; });
      return;
    }

    if (attData) setAttendance((prev) => new Map(prev).set(student.id, attData as Attendance));

    // 이 날짜가 availableDates에 없으면 새 날짜 → 목록 갱신
    refreshDates();

    if (willPromote) {
      const { error: promoteError } = await supabase
        .from("students").update({ is_active: true }).eq("id", student.id);
      if (promoteError) {
        setStudents((prev) =>
          prev.map((s) => (s.id === student.id ? { ...s, is_active: false } : s)),
        );
        toast.warning(`${student.name} 출석 저장됨, 활동 승격 실패: ${promoteError.message}`);
      } else {
            toast.success(`${student.name} 출석 처리 + 활동학생으로 승격`, { duration: 2500 });
      }
    }

    setSaving((prev) => { const s = new Set(prev); s.delete(student.id); return s; });
  }

  async function saveNote(studentId: string, text: string) {
    const trimmed = text.trim().slice(0, 500);
    const current = notes.get(studentId);
    if ((current?.note ?? "") === trimmed) return;
    setSaving((prev) => new Set(prev).add("note:" + studentId));
    if (trimmed === "") {
      setSaving((p) => { const s = new Set(p); s.delete("note:" + studentId); return s; });
      return;
    }
    const optimistic: AbsenceNote = current
      ? { ...current, note: trimmed, updated_at: new Date().toISOString() }
      : {
          id: "tmp-" + studentId,
          attend_date: date,
          student_id: studentId,
          note: trimmed,
          author_name: profile?.display_name || user?.email || null,
          author_id: user?.id ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
    setNotes((prev) => new Map(prev).set(studentId, optimistic));
    const { data, error } = await supabase
      .from("absence_notes")
      .upsert(
        {
          attend_date: date,
          student_id: studentId,
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
        if (current) m.set(studentId, current);
        else m.delete(studentId);
        return m;
      });
      toast.error("메모 저장 실패: " + error.message);
    } else if (data) {
      setNotes((prev) => new Map(prev).set(studentId, data as AbsenceNote));
      toast.success("메모를 저장했습니다", { duration: 1500 });
    }
    setSaving((p) => { const s = new Set(p); s.delete("note:" + studentId); return s; });
  }

  const inactiveCount = students.filter(
    (s) =>
      !s.is_active &&
      (gradeFilter === "ALL" || s.grade === gradeFilter) &&
      (classFilter === "ALL" || s.class_num === classFilter),
  ).length;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-8">
          <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            Issue · {date}
          </div>
          <h1 className="font-display text-4xl italic mt-1">
            {isAdmin ? "출석 입력" : "출석 조회"}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            {isAdmin
              ? "카드 배경을 누르면 출석 토글, 이름을 누르면 이력 패널이 열립니다."
              : "조회 전용 모드입니다. 출석 입력은 관리자 권한이 필요합니다."}
          </p>
          {!isAdmin && (
            <div className="mt-3 inline-flex items-center gap-2 text-[11px] uppercase tracking-wider px-3 py-1.5 bg-foreground/5 border border-foreground/15 text-muted-foreground">
              <Eye className="size-3" />
              조회 전용 모드
            </div>
          )}
        </header>

        {/* Controls */}
        <div className="bg-white/60 backdrop-blur-sm border border-foreground/10 px-5 py-4 mb-8 grid sm:grid-cols-[auto_1fr_1fr] gap-4 items-end">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">날짜</label>
            <DateSpinner snapToSunday />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">학년</label>
            <select
              value={gradeFilter}
              onChange={(e) => { setGradeFilter(e.target.value); setClassFilter("ALL"); }}
              className="w-full bg-background border border-input rounded-md h-9 px-3 text-sm"
            >
              <option value="ALL">전체</option>
              {grades.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">반</label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full bg-background border border-input rounded-md h-9 px-3 text-sm"
            >
              <option value="ALL">전체</option>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* 관리자 전용: 비활동 학생 토글 */}
        {isAdmin && inactiveCount > 0 && (
          <div className="flex items-center gap-3 mb-6">
            <button
              type="button"
              onClick={() => setShowInactive((v) => !v)}
              className={cn(
                "inline-flex items-center gap-2 text-xs px-3 py-1.5 border transition-colors",
                showInactive
                  ? "border-foreground/30 bg-foreground/8 text-foreground"
                  : "border-foreground/15 bg-white/60 text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "inline-block w-7 h-4 rounded-full transition-colors relative",
                  showInactive ? "bg-[oklch(0.32_0.05_250)]" : "bg-foreground/20",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-3 rounded-full bg-white transition-transform shadow-sm",
                    showInactive ? "translate-x-3.5" : "translate-x-0.5",
                  )}
                />
              </span>
              비활동 학생 표시 ({inactiveCount}명)
            </button>
            {showInactive && (
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                · 비활동 카드를 출석 처리하면 자동으로 활동학생으로 승격됩니다
              </span>
            )}
          </div>
        )}

        {/* Student Cards */}
        {fetching ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="animate-spin size-4" />
            출석 데이터 로드 중…
          </div>
        ) : classGroups.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-12">
            조건에 해당하는 학생이 없습니다.
          </div>
        ) : (
          <div className="space-y-10">
            {classGroups.map((cg) => {
              const classStudentIds = cg.genderGroups.flatMap((g) => g.students.map((s) => s.id));
              const classPresentCount = classStudentIds.filter((id) => attendance.get(id)?.status).length;

              return (
                <section key={cg.classKey}>
                  {(() => {
                    const classAbsentCount = classStudentIds.filter(
                      (id) => !attendance.get(id)?.status,
                    ).length;
                    const classMemoCount = classStudentIds.filter((id) => notes.get(id)?.note).length;
                    return (
                      <div className="flex items-baseline gap-3 mb-4 border-b-2 border-[oklch(0.32_0.05_250)] pb-2">
                        <h2 className="font-display text-2xl italic text-[oklch(0.32_0.05_250)]">
                          {cg.grade} {cg.classNum}
                        </h2>
                        <span className="text-sm text-muted-foreground tabular-nums">
                          출석 {classPresentCount}
                          {classAbsentCount > 0 && (
                            <span className="text-[oklch(0.55_0.15_25)] ml-2">결석 {classAbsentCount}</span>
                          )}
                          {classMemoCount > 0 && (
                            <span className="text-muted-foreground/70 ml-2">· 메모 {classMemoCount}</span>
                          )}
                        </span>
                      </div>
                    );
                  })()}

                  <div className="space-y-5">
                    {cg.genderGroups.map((gg) => {
                      const genderPresentCount = gg.students.filter(
                        (s) => attendance.get(s.id)?.status,
                      ).length;

                      return (
                        <div key={gg.gender}>
                          {(() => {
                            const genderAbsentCount = gg.students.filter(
                              (s) => !attendance.get(s.id)?.status,
                            ).length;
                            const genderMemoCount = gg.students.filter(
                              (s) => notes.get(s.id)?.note,
                            ).length;
                            return (
                              <div className="flex items-center gap-2 mb-2.5">
                                <span
                                  className={cn(
                                    "inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium border",
                                    gg.gender === "남"
                                      ? "bg-[oklch(0.93_0.04_250)] border-[oklch(0.75_0.08_250)] text-[oklch(0.32_0.05_250)]"
                                      : gg.gender === "여"
                                      ? "bg-[oklch(0.95_0.04_10)] border-[oklch(0.78_0.08_10)] text-[oklch(0.42_0.1_10)]"
                                      : "bg-foreground/5 border-foreground/20 text-muted-foreground",
                                  )}
                                >
                                  {gg.gender}
                                </span>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  출석 {genderPresentCount}
                                  {genderAbsentCount > 0 && (
                                    <span className="text-[oklch(0.55_0.15_25)] ml-1.5">결석 {genderAbsentCount}</span>
                                  )}
                                  {genderMemoCount > 0 && (
                                    <span className="text-muted-foreground/60 ml-1.5">· 메모 {genderMemoCount}</span>
                                  )}
                                </span>
                                <div className="flex-1 h-px bg-foreground/10" />
                              </div>
                            );
                          })()}

                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                            {gg.students.map((s) => {
                              const present = attendance.get(s.id)?.status ?? false;
                              const isSaving = saving.has(s.id);
                              const note = notes.get(s.id);
                              const noteSaving = saving.has("note:" + s.id);
                              const noteOpen = openNoteFor === s.id;
                              const hasNote = !!note?.note;
                              const inactive = !s.is_active;

                              return (
                                <div
                                  key={s.id}
                                  className={cn(
                                    "relative border transition-all duration-150",
                                    inactive
                                      ? "border-foreground/10 bg-foreground/3 opacity-60"
                                      : present
                                      ? "border-[oklch(0.45_0.18_25)] bg-white"
                                      : "border-foreground/15 bg-white",
                                  )}
                                >
                                  {inactive && (
                                    <div className="absolute top-1 left-1 text-[9px] uppercase tracking-wider px-1 py-0.5 bg-foreground/10 text-muted-foreground border border-foreground/15">
                                      비활동
                                    </div>
                                  )}

                                  {/* 카드 영역: 이름 클릭 → 이력 패널, 나머지 → 출석 토글 */}
                                  <div
                                    onClick={(e) => {
                                      if ((e.target as HTMLElement).closest("[data-memo-zone]")) return;
                                      toggle(s);
                                    }}
                                    role={isAdmin ? "button" : undefined}
                                    tabIndex={isAdmin ? 0 : undefined}
                                    onKeyDown={(e) => {
                                      if (isAdmin && (e.key === "Enter" || e.key === " ")) toggle(s);
                                    }}
                                    className={cn(
                                      "px-3 py-2.5",
                                      inactive ? "pt-5" : "",
                                      isAdmin ? "hover:-translate-y-0.5 hover:shadow-md cursor-pointer" : "cursor-default",
                                    )}
                                  >
                                    {/* 이름: 클릭 시 이력 패널 (출석 토글 이벤트 전파 차단) */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setHistoryStudent(s);
                                      }}
                                      className={cn(
                                        "font-display text-base leading-tight mt-0.5 text-left hover:underline underline-offset-2",
                                        inactive ? "text-foreground/50" : "",
                                      )}
                                    >
                                      {s.name}
                                    </button>
                                  </div>

                                  {/* 출석 스탬프 */}
                                  {present && (
                                    <div className="absolute -top-2 -right-2 size-10 rounded-full border-2 border-[oklch(0.45_0.18_25)] text-[oklch(0.45_0.18_25)] flex items-center justify-center font-display italic text-[9px] tracking-wider rotate-[-12deg] bg-white/90 shadow-sm">
                                      출석
                                    </div>
                                  )}
                                  {isSaving && (
                                    <Loader2 className="absolute top-2 right-2 size-3 animate-spin text-muted-foreground" />
                                  )}

                                  {/* 메모 영역 */}
                                  {!present && !inactive && (
                                    <div data-memo-zone className="border-t border-foreground/10 px-2.5 py-1.5">
                                      {noteOpen ? (
                                        <NoteEditor
                                          initial={note?.note ?? ""}
                                          saving={noteSaving}
                                          onSave={async (v) => {
                                            await saveNote(s.id, v);
                                            setOpenNoteFor(null);
                                          }}
                                          onCancel={() => setOpenNoteFor(null)}
                                        />
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setOpenNoteFor(s.id); }}
                                          className={cn(
                                            "w-full text-left text-xs flex items-start gap-1 hover:text-foreground transition-colors",
                                            hasNote ? "text-foreground/80" : "text-muted-foreground",
                                          )}
                                        >
                                          <MessageSquare className="size-3 mt-0.5 shrink-0" />
                                          <span className="line-clamp-2 text-[11px]">
                                            {hasNote ? note!.note : "결석 사유…"}
                                          </span>
                                        </button>
                                      )}
                                      {hasNote && !noteOpen && note?.author_name && (
                                        <div className="text-[10px] text-muted-foreground/70 mt-0.5 uppercase tracking-wider">
                                          · {note.author_name}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* M4-22: 새친구 섹션 (모든 주에 항상 표시) */}
        {
          <section className="mt-12">
            <div className="flex items-baseline gap-3 mb-4 border-b-2 border-rose-400 pb-2">
              <Sparkles className="size-5 text-rose-600" />
              <h2 className="font-display text-2xl italic text-rose-700">새친구</h2>
              <span className="text-sm text-muted-foreground tabular-nums">
                새친구 {guests.length}명
                {guests.filter((g) => guestAttendance.get(g.id)?.status).length > 0 && (
                  <span className="text-rose-600 ml-2">
                    출석 {guests.filter((g) => guestAttendance.get(g.id)?.status).length}
                  </span>
                )}
              </span>
              {isAdmin && (
                <button
                  onClick={() => setShowAddGuest(true)}
                  className="ml-auto flex items-center gap-1 text-xs px-2.5 py-1 bg-rose-600 text-white hover:bg-rose-700 transition-colors"
                >
                  <UserPlus className="size-3.5" /> 새친구 추가
                </button>
              )}
            </div>

            {guests.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8 border border-dashed border-foreground/15 bg-white/40">
                아직 등록된 새친구이 없습니다{isAdmin ? ". 우상단 [새친구 추가] 버튼으로 시작하세요." : ""}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                {guests.map((g) => {
                  const present = guestAttendance.get(g.id)?.status ?? false;
                  const isSavingG = savingGuest.has(g.id);
                  const inviter = g.inviter_student_id ? students.find((s) => s.id === g.inviter_student_id) : null;
                  return (
                    <div
                      key={g.id}
                      className={cn(
                        "relative border transition-all duration-150 px-3 py-2.5 group",
                        present
                          ? "border-rose-400 bg-white"
                          : "border-foreground/15 bg-white",
                        isAdmin ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : ""
                      )}
                      onClick={() => isAdmin && toggleGuestAttendance(g)}
                      role={isAdmin ? "button" : undefined}
                      tabIndex={isAdmin ? 0 : undefined}
                    >
                      <div className="absolute top-1 left-1 text-[9px] uppercase tracking-wider px-1 py-0.5 bg-rose-50 text-rose-600 border border-rose-200">
                        새친구
                      </div>
                      <div className="font-display text-base leading-tight mt-3">
                        {g.name}
                      </div>
                      {inviter && (
                        <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          ← {inviter.name}
                        </div>
                      )}
                      {(g.grade || g.class_num || g.gender) && (
                        <div className="text-[10px] text-muted-foreground/80 mt-0.5">
                          {g.grade ? `${g.grade}학년 ` : ""}{g.class_num ? `${g.class_num}반 ` : ""}{g.gender || ""}
                        </div>
                      )}
                      {present && (
                        <div className="absolute -top-2 -right-2 size-10 rounded-full border-2 border-rose-500 text-rose-600 flex items-center justify-center font-display italic text-[9px] tracking-wider rotate-[-12deg] bg-white/90 shadow-sm">
                          출석
                        </div>
                      )}
                      {isSavingG && (
                        <Loader2 className="absolute top-2 right-2 size-3 animate-spin text-muted-foreground" />
                      )}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); deleteGuest(g); }}
                          className="absolute bottom-1 right-1 p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="새친구 삭제"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        }
      </div>

      {/* 출석 이력 패널 */}
      <StudentHistoryPanel
        student={historyStudent}
        onClose={() => setHistoryStudent(null)}
        onStudentUpdate={(updated) => {
          setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
          setHistoryStudent(updated);
        }}
      />

      {/* M4-22: 손님 승격 모달 */}
      <GuestPromoteModal
        guest={promoteGuest}
        students={students}
        onClose={() => setPromoteGuest(null)}
        onPromoted={handlePromoted}
      />

      {/* M4-22: 새친구 추가 모달 */}
      <GuestAddModal
        open={showAddGuest}
        attendDate={date}
        students={students}
        autoCheckAttendance={true}
        onClose={() => setShowAddGuest(false)}
        onAdded={(g) => {
          setGuests((prev) => [...prev, g]);
          // 새친구 추가 시 자동 출석 체크 → guest_attendance 맵에도 반영
          setGuestAttendance((prev) => new Map(prev).set(g.id, {
            id: "tmp-" + g.id,
            guest_id: g.id,
            attend_date: date,
            status: true,
            created_at: new Date().toISOString(),
          }));
          setShowAddGuest(false);
        }}
      />
    </AppLayout>
  );
}

function NoteEditor({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: string;
  saving: boolean;
  onSave: (v: string) => void | Promise<void>;
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
        placeholder="결석 사유 (예: 가족 여행, 병결 등) · ⌘/Ctrl+Enter 저장"
        className="w-full text-xs px-2 py-1.5 border border-foreground/20 bg-white resize-none focus:outline-none focus:border-[oklch(0.32_0.05_250)]"
      />
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] text-muted-foreground">
          {value.length}/500 · 누구나 작성 가능
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={onCancel} disabled={saving}>취소</Button>
          <Button
            size="sm"
            className="h-6 px-2 text-[10px] bg-[oklch(0.32_0.05_250)] hover:bg-[oklch(0.28_0.05_250)]"
            onClick={() => onSave(value)}
            disabled={saving}
          >
            {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
            저장
          </Button>
        </div>
      </div>
    </div>
  );
}
