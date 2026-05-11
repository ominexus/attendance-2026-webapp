// Devotional Editorial 스타일: paper-tone 배경, ink-blue 액센트
// 마일스톤 3 - 출석 입력 페이지
// - 가장 최근 일요일을 기본 날짜로 설정
// - 학년/반 필터, 학생 카드 형태의 도장(stamp) 토글
// - Optimistic UI + Supabase upsert/delete
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase, type Student, type Attendance } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ChevronLeft, ChevronRight, Eye, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// 가장 최근 일요일 (오늘 포함)
function lastSunday(d: Date = new Date()): string {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  return x.toISOString().slice(0, 10);
}

function shiftDate(yyyymmdd: string, days: number): string {
  const d = new Date(yyyymmdd);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function Home() {
  const { isAdmin, user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Map<string, Attendance>>(new Map());
  const [date, setDate] = useState<string>(lastSunday());
  const [gradeFilter, setGradeFilter] = useState<string>("ALL");
  const [classFilter, setClassFilter] = useState<string>("ALL");
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState<Set<string>>(new Set());

  // 학생 명단 로드 (1회)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("grade")
        .order("class_num")
        .order("name");
      if (cancelled) return;
      if (error) {
        toast.error("학생 명단 로드 실패: " + error.message);
      } else {
        setStudents((data as Student[]) ?? []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 선택된 날짜의 출석 기록 로드
  useEffect(() => {
    let cancelled = false;
    setFetching(true);
    (async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("attendance_date", date);
      if (cancelled) return;
      if (error) {
        toast.error("출석 로드 실패: " + error.message);
      } else {
        const m = new Map<string, Attendance>();
        for (const a of (data as Attendance[]) ?? []) {
          m.set(a.student_id, a);
        }
        setAttendance(m);
      }
      setFetching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  // 필터 옵션 추출
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

  const filtered = students.filter(
    (s) =>
      (gradeFilter === "ALL" || s.grade === gradeFilter) &&
      (classFilter === "ALL" || s.class_num === classFilter),
  );

  const presentCount = filtered.filter((s) => attendance.get(s.id)?.status).length;

  // 출석 토글 (Optimistic + Supabase)
  async function toggle(student: Student) {
    if (!isAdmin) {
      toast.error("입력 권한이 없습니다", {
        description: user ? "관리자만 출석을 수정할 수 있습니다." : "로그인 후 관리자 권한이 필요합니다.",
      });
      return;
    }
    const current = attendance.get(student.id);
    const next = !current?.status;

    // Optimistic
    setSaving((prev) => new Set(prev).add(student.id));
    setAttendance((prev) => {
      const m = new Map(prev);
      if (current) {
        m.set(student.id, { ...current, status: next });
      } else {
        m.set(student.id, {
          id: "tmp-" + student.id,
          student_id: student.id,
          attendance_date: date,
          status: next,
          created_at: new Date().toISOString(),
        });
      }
      return m;
    });

    // 서버 반영
    const { error, data } = await supabase
      .from("attendance")
      .upsert(
        {
          student_id: student.id,
          attendance_date: date,
          status: next,
        },
        { onConflict: "student_id,attendance_date" },
      )
      .select()
      .single();

    if (error) {
      // 롤백
      setAttendance((prev) => {
        const m = new Map(prev);
        if (current) m.set(student.id, current);
        else m.delete(student.id);
        return m;
      });
      toast.error(`${student.name} 저장 실패: ${error.message}`);
    } else if (data) {
      setAttendance((prev) => {
        const m = new Map(prev);
        m.set(student.id, data as Attendance);
        return m;
      });
    }

    setSaving((prev) => {
      const s = new Set(prev);
      s.delete(student.id);
      return s;
    });
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Masthead */}
        <header className="mb-8">
          <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            Issue · {date}
          </div>
          <h1 className="font-display text-4xl italic mt-1">
            {isAdmin ? "출석 입력" : "출석 조회"}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            {isAdmin
              ? "학생 카드를 누르면 도장이 찍힙니다. 변경은 즉시 반영되며 네트워크 실패 시 자동 복원됩니다."
              : "조회 전용 모드입니다. 출석 입력은 관리자 권한이 필요합니다."}
          </p>
          {!isAdmin && (
            <div className="mt-3 inline-flex items-center gap-2 text-[11px] uppercase tracking-wider px-3 py-1.5 bg-foreground/5 border border-foreground/15 text-muted-foreground">
              {user ? <Eye className="size-3" /> : <ShieldCheck className="size-3" />}
              {user ? "Viewer·읽기 전용" : <>관리자이시라면 <Link href="/login"><a className="underline ml-1">로그인</a></Link></>}
            </div>
          )}
        </header>

        {/* Controls */}
        <div className="bg-white/60 backdrop-blur-sm border border-foreground/10 px-5 py-4 mb-8 grid sm:grid-cols-[auto_1fr_1fr_auto] gap-4 items-end">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              날짜
            </label>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setDate(shiftDate(date, -7))}
                aria-label="이전 주"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-40"
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setDate(shiftDate(date, 7))}
                aria-label="다음 주"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              학년
            </label>
            <select
              value={gradeFilter}
              onChange={(e) => {
                setGradeFilter(e.target.value);
                setClassFilter("ALL");
              }}
              className="w-full bg-background border border-input rounded-md h-9 px-3 text-sm"
            >
              <option value="ALL">전체</option>
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              반
            </label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full bg-background border border-input rounded-md h-9 px-3 text-sm"
            >
              <option value="ALL">전체</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              출석 / 전체
            </div>
            <div className="font-display italic text-2xl tabular-nums">
              {presentCount} <span className="text-foreground/30">/ {filtered.length}</span>
            </div>
          </div>
        </div>

        {/* Student Cards */}
        {fetching ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="animate-spin size-4" />
            출석 데이터 로드 중…
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.map((s) => {
              const present = attendance.get(s.id)?.status ?? false;
              const isSaving = saving.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggle(s)}
                  disabled={isSaving || !isAdmin}
                  className={cn(
                    "relative group text-left bg-white border px-4 py-3 transition-all duration-150",
                    isAdmin
                      ? "hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                      : "cursor-default",
                    present
                      ? "border-[oklch(0.45_0.18_25)] bg-[oklch(0.99_0.005_85)]"
                      : "border-foreground/15",
                  )}
                >
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s.grade} {s.class_num}
                  </div>
                  <div className="font-display text-lg mt-0.5">{s.name}</div>
                  {/* Stamp */}
                  {present && (
                    <div
                      className="absolute -top-2 -right-2 size-12 rounded-full border-2 border-[oklch(0.45_0.18_25)] text-[oklch(0.45_0.18_25)] flex items-center justify-center font-display italic text-[10px] tracking-wider rotate-[-12deg] bg-white/90 shadow-sm"
                      style={{ fontFeatureSettings: '"smcp"' }}
                    >
                      출석
                    </div>
                  )}
                  {isSaving && (
                    <Loader2 className="absolute bottom-2 right-2 size-3 animate-spin text-muted-foreground" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {filtered.length === 0 && !fetching && (
          <div className="text-center text-muted-foreground text-sm py-12">
            조건에 해당하는 학생이 없습니다.
          </div>
        )}
      </div>
    </AppLayout>
  );
}
