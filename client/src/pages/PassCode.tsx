/**
 * PassCode 페이지
 * Design: Devotional Editorial (잉크 블루 + 페이퍼 톤, Fraunces italic)
 *
 * 흐름:
 *  1. 사용자가 Pass Code 입력
 *  2. VITE_PASS_CODE 와 일치 여부 검증 (양쪽 trim() 후 비교)
 *  3. 일치 시 VITE_ADMIN_EMAIL / VITE_ADMIN_PASSWORD 로 Supabase signInWithPassword
 *  4. 성공하면 / 로 리다이렉트
 *  5. 실패 시 에러 메시지 표시
 *
 * 보안 메모: VITE_* 값은 빌드 번들에 포함됨. 실 데이터 보호는 Supabase RLS 담당.
 */
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Loader2, KeyRound, Eye, EyeOff, AlertCircle } from "lucide-react";

// 빌드 시 주입되는 환경변수 (양쪽 trim으로 공백 제거)
const PASS_CODE = (import.meta.env.VITE_PASS_CODE ?? "").trim();
const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL ?? "").trim();
const ADMIN_PASSWORD = (import.meta.env.VITE_ADMIN_PASSWORD ?? "").trim();
const IS_DEV = import.meta.env.DEV;

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

  // 환경변수 누락 여부 사전 진단
  const envMissing = !PASS_CODE || !ADMIN_EMAIL || !ADMIN_PASSWORD;
  const missingVars = [
    !PASS_CODE && "VITE_PASS_CODE",
    !ADMIN_EMAIL && "VITE_ADMIN_EMAIL",
    !ADMIN_PASSWORD && "VITE_ADMIN_PASSWORD",
  ].filter(Boolean);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (envMissing) {
      setError(`환경변수 미설정: ${missingVars.join(", ")}`);
      return;
    }

    // 입력값도 trim() 후 비교 (한영 전환 잔여 공백, 복사-붙여넣기 공백 처리)
    const inputCode = code.trim();

    if (inputCode !== PASS_CODE) {
      setError("코드가 일치하지 않습니다.");
      // dev 모드에서만 길이 힌트 표시 (운영에서는 노출 안 함)
      if (IS_DEV) {
        console.debug(
          `[PassCode] 입력 길이: ${inputCode.length}, env 길이: ${PASS_CODE.length}`,
          `입력: "${inputCode}"`,
        );
      }
      setCode("");
      inputRef.current?.focus();
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

        {/* 환경변수 누락 경고 (빌드 누락 시 명확히 표시) */}
        {envMissing && (
          <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-sm px-4 py-3 text-xs text-amber-800">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium mb-1">환경변수가 설정되지 않았습니다</div>
              <div className="text-amber-700">
                누락된 변수: <code>{missingVars.join(", ")}</code>
              </div>
              <div className="mt-1 text-amber-600">
                GitHub Actions 워크플로우의 env 블록과 Repository Secrets를 확인해 주세요.
              </div>
            </div>
          </div>
        )}

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
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
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
            <div className="flex items-center gap-2 text-[oklch(0.55_0.2_25)] text-xs tracking-wide">
              <AlertCircle className="size-3.5 shrink-0" />
              <span>{error}</span>
              {/* dev 모드에서만 env 길이 힌트 표시 */}
              {IS_DEV && error.includes("일치하지") && (
                <span className="ml-1 text-foreground/30">
                  (env 길이: {PASS_CODE.length})
                </span>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !code.trim()}
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
