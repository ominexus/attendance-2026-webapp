// Devotional Editorial 스타일: paper-tone 배경 + ink-blue 액센트, Fraunces 헤드라인
import { useState, FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Login() {
  const [, setLocation] = useLocation();
  const { signIn, session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 이미 로그인된 경우 즉시 메인으로 이동
  if (session) {
    setLocation("/");
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      toast.error("로그인 실패", { description: error });
      return;
    }
    setLocation("/");
  };

  return (
    <div className="min-h-screen flex">
      {/* 좌측 발행 정보 패널 (Editorial masthead) */}
      <aside className="hidden lg:flex w-[42%] bg-[oklch(0.32_0.05_250)] text-[oklch(0.97_0.012_85)] flex-col justify-between p-12 relative overflow-hidden">
        <div>
          <div className="text-xs tracking-[0.3em] uppercase opacity-70">Vol. 2026 · No. 01</div>
          <h1 className="font-display text-6xl leading-[1.05] mt-6 italic">
            고등부<br />출석부
          </h1>
        </div>
        <div className="space-y-2">
          <div className="h-px w-24 bg-current opacity-30" />
          <p className="text-sm leading-relaxed opacity-80 max-w-sm">
            매 주일의 발자취를 기록합니다. 한 주의 출석은 또 하나의 페이지가 됩니다.
          </p>
        </div>
        {/* 종이 결 텍스처 */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] bg-[length:12px_12px]" />
      </aside>

      {/* 우측 로그인 폼 */}
      <main className="flex-1 flex items-center justify-center p-8 bg-[oklch(0.97_0.012_85)]">
        <div className="w-full max-w-sm">
          <div className="mb-10">
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">
              인도자 로그인
            </div>
            <h2 className="font-display text-3xl italic">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Supabase 계정으로 로그인하세요.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs uppercase tracking-wider">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-transparent border-0 border-b border-foreground/30 rounded-none px-0 focus-visible:ring-0 focus-visible:border-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs uppercase tracking-wider">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="bg-transparent border-0 border-b border-foreground/30 rounded-none px-0 focus-visible:ring-0 focus-visible:border-foreground"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full mt-8 bg-[oklch(0.32_0.05_250)] hover:bg-[oklch(0.28_0.05_250)] rounded-none h-11 text-sm tracking-wider uppercase"
            >
              {submitting ? <Loader2 className="animate-spin size-4" /> : "Sign In"}
            </Button>
          </form>

          <div className="mt-8 text-[11px] text-muted-foreground leading-relaxed text-center">
            <span>관리자 계정으로 로그인하면 출석 입력이 가능합니다.</span>
          </div>
        </div>
      </main>
    </div>
  );
}
