// Devotional Editorial 스타일: 차트는 잉크 블루 단색 + 우드컷 느낌의 dotted grid
// 마일스톤 3 - 통계 대시보드
// - 주차별 전체 출석 인원 (라인)
// - 학년/반별 출석률 (바)
// - 개인별 출석 횟수 상위 (테이블)
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase, type Student, type Attendance, type AbsenceNote } from "@/lib/supabase";
import { Loader2, MessageSquare } from "lucide-react";
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

export default function Stats() {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [notes, setNotes] = useState<AbsenceNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [sRes, aRes, nRes] = await Promise.all([
        supabase.from("students").select("*"),
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
    return () => {
      cancelled = true;
    };
  }, []);

  // 메모 → 학생 조인 맵
  const studentMap = useMemo(() => {
    const m = new Map<string, Student>();
    for (const s of students) m.set(s.id, s);
    return m;
  }, [students]);

  // 주차별 출석 인원 (시간순)
  const weekly = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of attendance) {
      m.set(a.attendance_date, (m.get(a.attendance_date) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .map(([date, count]) => ({ date: date.slice(5), count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [attendance]);

  // 반별 출석률 = 반별 총 출석수 / (반별 학생수 × 진행 주차수)
  const classStats = useMemo(() => {
    const weeks = new Set(attendance.map((a) => a.attendance_date)).size || 1;
    const studentById = new Map(students.map((s) => [s.id, s] as const));
    const classCounts = new Map<string, { present: number; size: number }>();
    for (const s of students) {
      const key = `${s.grade} ${s.class_num}`;
      const cur = classCounts.get(key) ?? { present: 0, size: 0 };
      cur.size += 1;
      classCounts.set(key, cur);
    }
    for (const a of attendance) {
      const s = studentById.get(a.student_id);
      if (!s) continue;
      const key = `${s.grade} ${s.class_num}`;
      const cur = classCounts.get(key)!;
      cur.present += 1;
    }
    return Array.from(classCounts.entries())
      .map(([cls, { present, size }]) => ({
        cls,
        rate: Math.round((present / (size * weeks)) * 100),
        present,
        size,
      }))
      .sort((a, b) => a.cls.localeCompare(b.cls));
  }, [students, attendance]);

  // 개인별 출석 횟수 상위 10명
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

  const totalWeeks = new Set(attendance.map((a) => a.attendance_date)).size;
  const totalAttendance = attendance.length;
  const overallRate =
    totalWeeks > 0 && students.length > 0
      ? Math.round((totalAttendance / (students.length * totalWeeks)) * 100)
      : 0;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-8">
          <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            Statistics
          </div>
          <h1 className="font-display text-4xl italic mt-1">출석 통계</h1>
        </header>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="animate-spin size-4" />
            집계 중…
          </div>
        ) : (
          <>
            {/* KPI */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
              <Kpi label="등록 학생" value={`${students.length}명`} />
              <Kpi label="진행 주차" value={`${totalWeeks}주`} />
              <Kpi label="누적 출석" value={`${totalAttendance}건`} />
              <Kpi label="전체 출석률" value={`${overallRate}%`} highlight />
            </div>

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

            {/* 반별 출석률 */}
            <Section title="By Class" subtitle="반별 출석률 (%)">
              <div className="bg-white border border-foreground/10 p-4 h-[320px]">
                <ResponsiveContainer>
                  <BarChart data={classStats} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.85 0 0)" />
                    <XAxis dataKey="cls" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "oklch(0.97 0.012 85)",
                        border: "1px solid oklch(0.85 0 0)",
                        fontSize: 12,
                      }}
                      formatter={(v: number) => `${v}%`}
                    />
                    <Bar dataKey="rate" fill={INK} radius={[2, 2, 0, 0]} />
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

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`border px-4 py-3 ${
        highlight ? "border-[oklch(0.45_0.18_25)] bg-white" : "border-foreground/10 bg-white/60"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`font-display italic text-2xl mt-1 tabular-nums ${
          highlight ? "text-[oklch(0.45_0.18_25)]" : ""
        }`}
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
