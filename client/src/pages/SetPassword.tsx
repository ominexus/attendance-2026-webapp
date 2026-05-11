// 마일스톤 4: 초대 링크 또는 비밀번호 재설정 후 비밀번호 설정 페이지
// - Supabase Auth 의 invite/recovery 링크는 access_token 을 hash 로 전달
// - detectSessionInUrl 가 자동 처리하므로 onAuthStateChange 후 updateUser({password})
import { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function SetPassword() {
  const [, setLocation] = useLocation();
  const { user, updatePassword, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    // 초대/복구 링크는 #access_token=... 형식으로 들어옴
    if (window.location.hash.includes("access_token")) {
      setHint("초대 링크에서 진입했습니다. 사용할 비밀번호를 설정해 주세요.");
    } else if (!loading && !user) {
      setHint("이 페이지는 초대 링크 또는 로그인 후에만 사용할 수 있습니다.");
    }
  }, [loading, user]);

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
    const { error } = await updatePassword(password);
    setSubmitting(false);
    if (error) {
      toast.error("설정 실패", { description: error });
      return;
    }
    toast.success("비밀번호가 설정되었습니다");
    setLocation("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[oklch(0.97_0.012_85)] p-8">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">
            Invitation
          </div>
          <h2 className="font-display text-3xl italic">비밀번호 설정</h2>
          {hint && <p className="text-sm text-muted-foreground mt-2">{hint}</p>}
        </div>

        <form onSubmit={handle} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="pw" className="text-xs uppercase tracking-wider">
              New Password (8+)
            </Label>
            <Input
              id="pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="bg-transparent border-0 border-b border-foreground/30 rounded-none px-0 focus-visible:ring-0 focus-visible:border-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cfm" className="text-xs uppercase tracking-wider">
              Confirm
            </Label>
            <Input
              id="cfm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              className="bg-transparent border-0 border-b border-foreground/30 rounded-none px-0 focus-visible:ring-0 focus-visible:border-foreground"
            />
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full mt-8 rounded-none bg-[oklch(0.32_0.05_250)] hover:bg-[oklch(0.28_0.05_250)] h-11 text-sm tracking-wider uppercase"
          >
            {submitting ? <Loader2 className="animate-spin size-4" /> : "Save"}
          </Button>
        </form>
      </div>
    </div>
  );
}
