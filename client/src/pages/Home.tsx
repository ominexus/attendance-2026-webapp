// Devotional Editorial 스타일: paper-tone 배경, sidebar rail + canvas 레이아웃
// 마일스톤 2 - 인증 후 진입하는 메인 페이지. 학생 명단 로드 검증.
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, type Student } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, loading, signOut } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [loading, user, setLocation]);

  useEffect(() => {
    if (!user) return;
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
        console.error(error);
      } else {
        setStudents((data as Student[]) ?? []);
      }
      setFetching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[oklch(0.97_0.012_85)]">
        <Loader2 className="animate-spin size-6 text-foreground/40" />
      </div>
    );
  }

  // 학년별 그룹화
  const grouped = students.reduce<Record<string, Student[]>>((acc, s) => {
    const key = `${s.grade} ${s.class_num}`;
    (acc[key] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[oklch(0.97_0.012_85)] text-foreground">
      {/* Masthead */}
      <header className="border-b border-foreground/10">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-end justify-between">
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
              Vol. 2026
            </div>
            <h1 className="font-display text-3xl italic mt-1">고등부 출석부</h1>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-muted-foreground">{user.email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-xs uppercase tracking-wider gap-2"
            >
              <LogOut className="size-3.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8">
          <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2">
            Roster
          </div>
          <h2 className="font-display text-4xl italic">학생 명단</h2>
          <p className="text-sm text-muted-foreground mt-2">
            총 {students.length}명 · 출석 입력/통계 기능은 마일스톤 3에서 제공됩니다.
          </p>
        </div>

        {fetching ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="animate-spin size-4" />
            <span>명단을 불러오는 중…</span>
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(grouped).map(([key, list]) => (
              <section key={key}>
                <div className="flex items-baseline gap-4 mb-4">
                  <div className="font-display italic text-xl">{key}</div>
                  <div className="h-px flex-1 bg-foreground/15" />
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {list.length}명
                  </div>
                </div>
                <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
                  {list.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between border-b border-dotted border-foreground/15 py-1.5"
                    >
                      <span>{s.name}</span>
                      <span className="text-xs text-muted-foreground">{s.gender}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-foreground/10 mt-16 py-6 text-center text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
        Milestone 2 · Auth + Roster
      </footer>
    </div>
  );
}
