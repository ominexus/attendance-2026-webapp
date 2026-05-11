// 마일스톤 4: 회원가입 페이지 (Supabase Auth signUp)
// - 이메일 인증 활성화 시: 메일 확인 후 자동 로그인
// - 비활성 시: 즉시 로그인 가능
import { FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Signup() {
  const [, setLocation] = useLocation();
  const { signUp, session } = useAuth();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (session && !done) {
    setLocation("/");
    return null;
  }

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("비밀번호는 8자 이상이어야 합니다");
      return;
    }
    if (password !== confirm) {
      toast.error("비밀번호 확인이 일치하지 않습니다");
      return;
    }
    setSubmitting(true);
    const { error } = await signUp(email, password, displayName);
    setSubmitting(false);
    if (error) {
      toast.error("가입 실패", { description: error });
      return;
    }
    setDone(true);
    toast.success("가입 요청을 보냈습니다");
  };

  return (
    <div className="min-h-screen flex bg-[oklch(0.97_0.012_85)]">
      <aside className="hidden lg:flex w-[42%] bg-[oklch(0.32_0.05_250)] text-[oklch(0.97_0.012_85)] flex-col justify-between p-12">
        <div>
          <div className="text-xs tracking-[0.3em] uppercase opacity-70">Vol. 2026 · No. 02</div>
          <h1 className="font-display text-6xl leading-[1.05] mt-6 italic">
            새 페이지를<br />여십시오
          </h1>
        </div>
        <p className="text-sm leading-relaxed opacity-80 max-w-sm">
          가입한 계정은 기본적으로 인도자 권한을 가집니다.<br />
          관리자 권한은 기존 관리자가 명단 관리에서 부여합니다.
        </p>
      </aside>

      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-10">
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">
              Account
            </div>
            <h2 className="font-display text-3xl italic">Sign up</h2>
            <p className="text-sm text-muted-foreground mt-2">
              인도자용 계정을 새로 만듭니다.
            </p>
          </div>

          {done ? (
            <div className="space-y-4">
              <div className="border border-foreground/15 bg-white px-4 py-5">
                <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2">
                  확인 메일 발송
                </div>
                <p className="text-sm leading-relaxed">
                  <strong>{email}</strong> 로 인증 메일을 보냈습니다. 메일 본문의 링크를 누르면
                  인증이 완료되고 자동 로그인됩니다.
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  Supabase 프로젝트에서 Email Confirmation 이 비활성화된 경우 즉시 로그인할 수 있습니다.
                </p>
              </div>
              <Button
                onClick={() => setLocation("/login")}
                className="w-full rounded-none bg-[oklch(0.32_0.05_250)] hover:bg-[oklch(0.28_0.05_250)] h-11 text-sm tracking-wider uppercase"
              >
                로그인 페이지로
              </Button>
            </div>
          ) : (
            <form onSubmit={handle} className="space-y-5">
              <Field id="display" label="Name" value={displayName} onChange={setDisplayName} placeholder="홍길동" />
              <Field id="email" label="Email" type="email" value={email} onChange={setEmail} required autoComplete="email" />
              <Field
                id="password"
                label="Password (8+)"
                type="password"
                value={password}
                onChange={setPassword}
                required
                autoComplete="new-password"
              />
              <Field
                id="confirm"
                label="Confirm Password"
                type="password"
                value={confirm}
                onChange={setConfirm}
                required
                autoComplete="new-password"
              />
              <Button
                type="submit"
                disabled={submitting}
                className="w-full mt-8 rounded-none bg-[oklch(0.32_0.05_250)] hover:bg-[oklch(0.28_0.05_250)] h-11 text-sm tracking-wider uppercase"
              >
                {submitting ? <Loader2 className="animate-spin size-4" /> : "Create Account"}
              </Button>
            </form>
          )}

          <div className="mt-8 text-[11px] text-muted-foreground">
            이미 계정이 있으신가요?{" "}
            <Link href="/login">
              <a className="underline underline-offset-4 hover:text-foreground">로그인</a>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  ...rest
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs uppercase tracking-wider">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent border-0 border-b border-foreground/30 rounded-none px-0 focus-visible:ring-0 focus-visible:border-foreground"
        {...rest}
      />
    </div>
  );
}
