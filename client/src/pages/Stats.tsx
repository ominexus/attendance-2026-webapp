// Devotional Editorial 스타일: 차트는 잉크 블루 단색 + 우드컷 느낌의 dotted grid
// 마일스톤 3 - 통계 대시보드
// 마일스톤 4-7: KPI를 출석률 제거 → 행동·활동 중심 지표로 전환
// 마일스톤 4-8: KPI·차트 모두 is_active=true 활동 학생 기준으로 보정
// 마일스톤 4-12: 기준일 변경 컨트롤 + 학년별 출석 통계 섹션 추가
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase, type Student, type Attendance, type AbsenceNote } from "@/lib/supabase";
import { Loader2, MessageSquare } from "lucide-react";
import { DateSpinner } from "@/components/DateSpinner";
import { useSelectedDate } from "@/contexts/SelectedDateContext";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";

const INK = "oklch(0.32 0.05 250)";
const WINE = "oklch(0.45 0.18 25)";
const GRADE_COLORS = [
  "oklch(0.32 0.05 250)",  // 1학년 - 잉크 블루
  "oklch(0.45 0.18 25)",   // 2학년 - 와인
  "oklch(0.55 0.12 145)",  // 3학년 - 포레스트 그린
];

// 특정 날짜 기준 가장 최근 일요일 (해당 날짜가 일요일이면 그 날)
function lastSundayFrom(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

// 오늘 기준 가장 최근 일요일
function todayLastSunday(): string {
  return lastSundayFrom(new Date().toISOString().slice(0, 10));
}

// 기준일로부터 N주 전 일요일
function sundayNWeeksBeforeRef(ref: string, n: number): string {
  const d = new Date(ref + "T00:00:00");
  d.setDate(d.getDate() - 7 * n);
  return d.toISOString().slice(0, 10);
}

export default function Stats() {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [notes, setNotes] = useState<AbsenceNote[]>([]);
  const [loading, setLoading] = useState(true);

  // 기준일: SelectedDateContext와 동기화
  const { selectedDate: refDate } = useSelectedDate();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [sRes, aRes, nRes] = await Promise.all([
        supabase.from("students").select("*").eq("is_active", true),
        supabase.from("attendance").select("*").eq("status", true),
        supabase
          .from("absence_notes")
          .select("*")
          .order("attend_date", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(50),
      ]);
      if (cancelled) return;
      if (sRes.error || aRes.error || nRes.error) {
        toast.error("데이터 로드 실패");
      } else {
        setStudents((sRes.data as Student[]) ?? []);
        setAttendance((aRes.data as Attendance[]) ?? []);
        setNotes((nRes.data as AbsenceNote[]) ?? []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // 메모 → 학생 조인 맵
  const studentMap = useMemo(() => {
    const m = new Map<string, Student>();
    for (const s of students) m.set(s.id, s);
    return m;
  }, [students]);

  // ── 날짜 기준값 (기준일 기반) ─────────────────────────────
  const fourWeeksAgo = useMemo(() => sundayNWeeksBeforeRef(refDate, 3), [refDate]);

  // ── 주차별 출석 인원 (라인 차트용) ───────────────────────
  const weekly = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of attendance) {
      m.set(a.attendance_date, (m.get(a.attendance_date) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .map(([date, count]) => ({ date: date.slice(5), count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [attendance]);

  // ── 반별 출석 인원 (바 차트용, 절대값) ───────────────────
  const classStats = useMemo(() => {
    const studentById = new Map(students.map((s) => [s.id, s] as const));
    const classCounts = new Map<string, number>();
    for (const a of attendance) {
      const s = studentById.get(a.student_id);
      if (!s) continue;
      const key = `${s.grade} ${s.class_num}`;
      classCounts.set(key, (classCounts.get(key) ?? 0) + 1);
    }
    for (const s of students) {
      const key = `${s.grade} ${s.class_num}`;
      if (!classCounts.has(key)) classCounts.set(key, 0);
    }
    return Array.from(classCounts.entries())
      .map(([cls, count]) => ({ cls, count }))
      .sort((a, b) => a.cls.localeCompare(b.cls));
  }, [students, attendance]);

  // ── 개인별 출석 횟수 상위 10명 ────────────────────────────
  const topStudents = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of attendance) m.set(a.student_id, (m.get(a.student_id) ?? 0) + 1);
    const studentById = new Map(students.map((s) => [s.id, s] as const));
    return Array.from(m.entries())
      .map(([id, n]) => ({ student: studentById.get(id), count: n }))
      .filter((x) => x.student)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [students, attendance]);

  // ── KPI 집계 (기준일 기반) ────────────────────────────────

  // 1) 기준일 출석 인원
  const thisWeekPresent = useMemo(
    () => attendance.filter((a) => a.attendance_date === refDate).length,
    [attendance, refDate],
  );

  // 2) 기준일 결석 인원
  const thisWeekAbsent = useMemo(() => {
    const presentIds = new Set(
      attendance.filter((a) => a.attendance_date === refDate).map((a) => a.student_id),
    );
    if (presentIds.size === 0) return 0;
    return students.filter((s) => !presentIds.has(s.id)).length;
  }, [attendance, students, refDate]);

  // 3) 최근 4주 평균 출석 인원 (기준일 기준)
  const recentAvg = useMemo(() => {
    const recentDates = Array.from(
      new Set(
        attendance
          .filter((a) => a.attendance_date >= fourWeeksAgo && a.attendance_date <= refDate)
          .map((a) => a.attendance_date),
      ),
    );
    if (recentDates.length === 0) return 0;
    const total = recentDates.reduce(
      (sum, d) => sum + attendance.filter((a) => a.attendance_date === d).length,
      0,
    );
    return Math.round(total / recentDates.length);
  }, [attendance, fourWeeksAgo, refDate]);

  // 4) 신규 출석자 수 (최근 4주 내 첫 출석)
  const newAttendees = useMemo(() => {
    const firstDate = new Map<string, string>();
    for (const a of attendance) {
      const cur = firstDate.get(a.student_id);
      if (!cur || a.attendance_date < cur) firstDate.set(a.student_id, a.attendance_date);
    }
    return Array.from(firstDate.values()).filter((d) => d >= fourWeeksAgo && d <= refDate).length;
  }, [attendance, fourWeeksAgo, refDate]);

  // 5) 연속 출석 3주 이상 학생 수 (기준일 기준 최근 3개 날짜)
  const streak3Plus = useMemo(() => {
    const allDates = Array.from(
      new Set(attendance.filter((a) => a.attendance_date <= refDate).map((a) => a.attendance_date))
    ).sort();
    if (allDates.length < 3) return 0;
    const byStudent = new Map<string, Set<string>>();
    for (const a of attendance) {
      if (!byStudent.has(a.student_id)) byStudent.set(a.student_id, new Set());
      byStudent.get(a.student_id)!.add(a.attendance_date);
    }
    const last3 = allDates.slice(-3);
    let count = 0;
    for (const dates of Array.from(byStudent.values())) {
      if (last3.every((d) => dates.has(d))) count++;
    }
    return count;
  }, [attendance, refDate]);

  // 6) 기준일 결석 사유 메모 건수
  const thisWeekMemoCount = useMemo(
    () => notes.filter((n) => n.attend_date === refDate).length,
    [notes, refDate],
  );

  // ── 학년별 통계 (기준일 기반) ─────────────────────────────
  const gradeStats = useMemo(() => {
    const grades = ["1학년", "2학년", "3학년"];
    return grades.map((grade, gi) => {
      const gradeStudents = students.filter((s) => s.grade === grade);
      const gradeIds = new Set(gradeStudents.map((s) => s.id));

      // 기준일 출석
      const presentIds = new Set(
        attendance.filter((a) => a.attendance_date === refDate && gradeIds.has(a.student_id)).map((a) => a.student_id)
      );
      const present = presentIds.size;
      const absent = present > 0 ? gradeStudents.length - present : 0;

      // 기준일 메모
      const memoCount = notes.filter((n) => n.attend_date === refDate && gradeIds.has(n.student_id)).length;

      // 최근 4주 평균
      const recentDates = Array.from(new Set(
        attendance.filter((a) => a.attendance_date >= fourWeeksAgo && a.attendance_date <= refDate && gradeIds.has(a.student_id)).map((a) => a.attendance_date)
      ));
      const avg4w = recentDates.length === 0 ? 0 : Math.round(
        recentDates.reduce((sum, d) => sum + attendance.filter((a) => a.attendance_date === d && gradeIds.has(a.student_id)).length, 0) / recentDates.length
      );

      // 연속 3주 이상
      const allGradeDates = Array.from(new Set(
        attendance.filter((a) => a.attendance_date <= refDate && gradeIds.has(a.student_id)).map((a) => a.attendance_date)
      )).sort();
      const last3 = allGradeDates.slice(-3);
      const byStudent = new Map<string, Set<string>>();
      for (const a of attendance.filter((a) => gradeIds.has(a.student_id))) {
        if (!byStudent.has(a.student_id)) byStudent.set(a.student_id, new Set());
        byStudent.get(a.student_id)!.add(a.attendance_date);
      }
      const streak3 = last3.length < 3 ? 0 : Array.from(byStudent.values()).filter((ds) => last3.every((d) => ds.has(d))).length;

      return { grade, present, absent, memoCount, avg4w, streak3, color: GRADE_COLORS[gi], total: gradeStudents.length };
    });
  }, [students, attendance, notes, refDate, fourWeeksAgo]);


  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-8">
          <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            Statistics
          </div>
          <h1 className="font-display text-4xl italic mt-1">출석 통계</h1>

          {/* 기준일 변경 컨트롤 */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">기준일</span>
            <DateSpinner />
            <span className="text-[10px] text-muted-foreground/60">활동 학생 기준</span>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="animate-spin size-4" />
            집계 중…
          </div>
        ) : (
          <>
            {/* KPI - 행동·활동 중심 지표 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
              <Kpi
                label="기준일 출석"
                value={`${thisWeekPresent}명`}
                sub={refDate}
                highlight
              />
              <Kpi
                label="기준일 결석"
                value={thisWeekAbsent > 0 ? `${thisWeekAbsent}명` : "—"}
                sub={thisWeekAbsent === 0 ? "입력 전 또는 전원 출석" : "출석 기록 없음"}
                warn={thisWeekAbsent > 0}
              />
              <Kpi
                label="최근 4주 평균"
                value={recentAvg > 0 ? `${recentAvg}명` : "—"}
                sub="주당 평균 출석 인원"
              />
              <Kpi
                label="신규 출석자"
                value={`${newAttendees}명`}
                sub="최근 4주 내 첫 출석"
              />
              <Kpi
                label="연속 3주 이상"
                value={`${streak3Plus}명`}
                sub="최근 3주 연속 출석"
              />
              <Kpi
                label="기준일 메모"
                value={thisWeekMemoCount > 0 ? `${thisWeekMemoCount}건` : "—"}
                sub="결석 사유 기록"
              />
            </div>

            {/* 학년별 통계 */}
            <Section title="By Grade" subtitle="학년별 출석 현황">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {gradeStats.map((g) => (
                  <div key={g.grade} className="bg-white border border-foreground/10 p-5">
                    <div className="flex items-baseline justify-between mb-4">
                      <div
                        className="text-[10px] uppercase tracking-[0.25em] font-medium"
                        style={{ color: g.color }}
                      >
                        {g.grade}
                      </div>
                      <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                        활동 {g.total}명
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <GradeKpi label="기준일 출석" value={g.present > 0 ? `${g.present}명` : "—"} color={g.color} />
                      <GradeKpi label="기준일 결석" value={g.absent > 0 ? `${g.absent}명` : "—"} />
                      <GradeKpi label="4주 평균" value={g.avg4w > 0 ? `${g.avg4w}명` : "—"} />
                      <GradeKpi label="연속 3주+" value={`${g.streak3}명`} />
                    </div>
                    {g.memoCount > 0 && (
                      <div className="mt-3 pt-3 border-t border-foreground/8 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <MessageSquare className="size-3 shrink-0" />
                        기준일 메모 {g.memoCount}건
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            {/* 주차별 추이 */}
            <Section title="Weekly Attendance" subtitle="주차별 출석 인원">
              <div className="bg-white border border-foreground/10 p-4 h-[300px]">
                <ResponsiveContainer>
                  <LineChart data={weekly} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.85 0 0)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: "oklch(0.97 0.012 85)",
                        border: "1px solid oklch(0.85 0 0)",
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`${v}명`, "출석 인원"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={INK}
                      strokeWidth={2}
                      dot={{ r: 3, fill: INK }}
                      activeDot={{ r: 5, fill: WINE }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Section>

            {/* 반별 출석 인원 (절대값) */}
            <Section title="By Class" subtitle="반별 누적 출석 인원">
              <div className="bg-white border border-foreground/10 p-4 h-[320px]">
                <ResponsiveContainer>
                  <BarChart data={classStats} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.85 0 0)" />
                    <XAxis dataKey="cls" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: "oklch(0.97 0.012 85)",
                        border: "1px solid oklch(0.85 0 0)",
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`${v}건`, "누적 출석"]}
                    />
                    <Bar dataKey="count" fill={INK} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>

            {/* 출석 상위 학생 */}
            <Section title="Roll of Honor" subtitle="개인별 출석 횟수 상위">
              <div className="bg-white border border-foreground/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3 w-12">#</th>
                      <th className="px-4 py-3">이름</th>
                      <th className="px-4 py-3">학년 · 반</th>
                      <th className="px-4 py-3 text-right">출석 횟수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topStudents.map(({ student, count }, i) => (
                      <tr key={student!.id} className="border-t border-foreground/10">
                        <td className="px-4 py-2.5 font-display italic text-muted-foreground tabular-nums">
                          {i + 1}
                        </td>
                        <td className="px-4 py-2.5 font-medium">{student!.name}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">
                          {student!.grade} {student!.class_num}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-display italic">
                          {count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* 결석 사유 메모 */}
            <Section
              title="Absence Notes"
              subtitle={`최근 결석 사유 메모 (${notes.length}건)`}
            >
              {notes.length === 0 ? (
                <div className="bg-white border border-foreground/10 px-4 py-8 text-center text-sm text-muted-foreground">
                  아직 기록된 메모가 없습니다.
                </div>
              ) : (
                <div className="bg-white border border-foreground/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3 w-32">날짜</th>
                        <th className="px-4 py-3 w-40">학생</th>
                        <th className="px-4 py-3">사유</th>
                        <th className="px-4 py-3 w-32">작성자</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notes.map((n) => {
                        const s = studentMap.get(n.student_id);
                        return (
                          <tr key={n.id} className="border-t border-foreground/10">
                            <td className="px-4 py-2.5 text-muted-foreground text-xs tabular-nums">
                              {n.attend_date}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="font-medium">{s?.name ?? "(삭제됨)"}</div>
                              {s && (
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                  {s.grade} {s.class_num}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-start gap-1.5 text-foreground/80">
                                <MessageSquare className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                                <span className="whitespace-pre-wrap">{n.note}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">
                              {n.author_name ?? "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function Kpi({
  label,
  value,
  sub,
  highlight,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`border px-4 py-3 ${
        highlight
          ? "border-[oklch(0.45_0.18_25)] bg-white"
          : warn
          ? "border-[oklch(0.65_0.12_25)] bg-white/80"
          : "border-foreground/10 bg-white/60"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`font-display italic text-2xl mt-1 tabular-nums ${
          highlight
            ? "text-[oklch(0.45_0.18_25)]"
            : warn
            ? "text-[oklch(0.55_0.15_25)]"
            : ""
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[10px] text-muted-foreground/70 mt-0.5 leading-tight">{sub}</div>
      )}
    </div>
  );
}

function GradeKpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border border-foreground/8 bg-[oklch(0.97_0.012_85)] px-2.5 py-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className="font-display italic text-lg mt-0.5 tabular-nums"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <div className="flex items-baseline gap-3 mb-3">
        <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">{title}</div>
        <div className="h-px flex-1 bg-foreground/15" />
        <div className="font-display italic text-sm text-muted-foreground">{subtitle}</div>
      </div>
      {children}
    </section>
  );
}
