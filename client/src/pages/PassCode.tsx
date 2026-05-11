/**
 * PassCode 페이지
 * Design: Devotional Editorial (잉크 블루 + 페이퍼 톤, Fraunces italic)
 *
 * 흐름:
 *  1. 사용자가 Pass Code 입력
 *  2. VITE_PASS_CODE 와 일치하면 VITE_ADMIN_EMAIL / VITE_ADMIN_PASSWORD 로 Supabase signIn
 *  3. 성공 시 / 로 리다이렉트
 *  4. 실패 시 에러 메시지 표시
 *
 * 보안 메모: VITE_* 값은 빌드 번들에 포함됨. 실 데이터 보호는 Supabase RLS 가 담당.
 */
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Loader2, KeyRound, Eye, EyeOff } from "lucide-react";

const PASS_CODE = import.meta.env.VITE_PASS_CODE ?? "";
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? "";

export default function PassCode() {
  const [, setLocation] = useLocation();
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!PASS_CODE) {
      setError("서버에 PASS_CODE 환경변수가 설정되지 않았습니다.");
      return;
    }

    if (code !== PASS_CODE) {
      setError("코드가 일치하지 않습니다.");
      setCode("");
      inputRef.current?.focus();
      return;
    }

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      setError("관리자 계정 정보가 설정되지 않았습니다.");
      return;
    }

    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    setLoading(false);

    if (signInError) {
      setError("로그인에 실패했습니다: " + signInError.message);
      return;
    }

    setLocation("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[oklch(0.97_0.012_85)] px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-2">
            Vol. 2026
          </div>
          <h1
            className="font-display italic text-4xl text-[oklch(0.32_0.05_250)] leading-tight"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            고등부
            <br />
            출석부
          </h1>
          <div className="mt-4 w-8 h-px bg-foreground/20 mx-auto" />
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-foreground/10 rounded-sm shadow-sm px-8 py-8 space-y-6"
        >
          <div className="flex items-center gap-2 text-foreground/50 text-xs uppercase tracking-widest">
            <KeyRound className="size-3.5" />
            <span>Pass Code</span>
          </div>

          {/* Input */}
          <div className="relative">
            <input
              ref={inputRef}
              type={show ? "text" : "password"}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit(e as unknown as React.FormEvent);
              }}
              placeholder="코드를 입력하세요"
              autoComplete="off"
              className="w-full border border-foreground/20 rounded-sm px-4 py-3 pr-10 text-sm bg-[oklch(0.97_0.012_85)] focus:outline-none focus:border-[oklch(0.32_0.05_250)] transition-colors placeholder:text-foreground/30 tracking-widest"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground/60 transition-colors"
              tabIndex={-1}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          {/* Error */}
          {error && (
            <p className="text-[oklch(0.55_0.2_25)] text-xs tracking-wide">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !code}
            className="w-full py-3 bg-[oklch(0.32_0.05_250)] text-[oklch(0.97_0.012_85)] text-xs uppercase tracking-[0.2em] rounded-sm hover:bg-[oklch(0.28_0.05_250)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                인증 중...
              </>
            ) : (
              "입장"
            )}
          </button>
        </form>

        {/* Footer note */}
        <p className="mt-6 text-center text-[10px] text-foreground/30 tracking-wide">
          관리자 코드 입력 시 출석 입력 기능이 활성화됩니다
        </p>
      </div>
    </div>
  );
}
