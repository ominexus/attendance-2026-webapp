// Devotional Editorial 공통 레이아웃
// - 비로그인 허용 (Public Read 정책에 따라 조회만 가능)
// - 로그인 시 관리자/일반 식별 배지 표시
// - 좌측 narrow rail에 네비게이션 (잉크 블루 배경)
import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  LogIn,
  Stamp,
  BarChart3,
  Users,
  Loader2,
  ShieldCheck,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  path: string;
  label: string;
  Icon: typeof Stamp;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/", label: "출석", Icon: Stamp },
  { path: "/stats", label: "통계", Icon: BarChart3 },
  { path: "/roster", label: "명단", Icon: Users },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, loading, signOut, isAdmin, profile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[oklch(0.97_0.012_85)]">
        <Loader2 className="animate-spin size-6 text-foreground/40" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[oklch(0.97_0.012_85)]">
      {/* Navigation Rail */}
      <aside className="hidden md:flex w-56 flex-col bg-[oklch(0.32_0.05_250)] text-[oklch(0.97_0.012_85)] py-8 px-5">
        <div className="mb-12">
          <div className="text-[10px] tracking-[0.3em] uppercase opacity-60">Vol. 2026</div>
          <div className="font-display italic text-2xl mt-1 leading-tight">
            고등부
            <br />
            출석부
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map(({ path, label, Icon }) => {
            const active = location === path;
            return (
              <Link key={path} href={path}>
                <a
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 text-sm tracking-wider transition-colors border-l-2",
                    active
                      ? "border-current bg-white/5"
                      : "border-transparent text-white/60 hover:text-white hover:bg-white/5",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="uppercase tracking-wider text-xs">{label}</span>
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 pt-4 space-y-2">
          {user && isAdmin ? (
            <>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-70">
                <ShieldCheck className="size-3" />
                Admin
              </div>
              <div className="text-xs truncate" title={user.email ?? ""}>
                {profile?.display_name || user.email}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="w-full justify-start gap-2 text-xs uppercase tracking-wider text-white/70 hover:text-white hover:bg-white/10 px-2"
              >
                <LogOut className="size-3.5" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onClick={() => setLocation("/login")}
                className="w-full justify-start gap-2 text-xs uppercase tracking-wider bg-white/10 hover:bg-white/20"
              >
                <LogIn className="size-3.5" />
                {user ? "Sign Out" : "Sign In (Admin)"}
              </Button>
              {user && (
                <button
                  onClick={signOut}
                  className="w-full text-left text-[10px] uppercase tracking-wider opacity-40 hover:opacity-70 px-2 py-1"
                >
                  로그아웃
                </button>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-[oklch(0.32_0.05_250)] text-[oklch(0.97_0.012_85)] flex items-center justify-between px-4 py-3">
        <div className="font-display italic text-base">고등부 출석부</div>
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ path, label, Icon }) => (
            <Link key={path} href={path}>
              <a
                className={cn(
                  "px-2.5 py-1.5 text-[10px] uppercase tracking-wider rounded-sm flex items-center gap-1",
                  location === path ? "bg-white/15" : "opacity-60",
                )}
              >
                <Icon className="size-3" />
                {label}
              </a>
            </Link>
          ))}
          {user ? (
            <button
              onClick={signOut}
              className="ml-1 px-2 py-1.5 text-[10px] opacity-70"
              title="Sign out"
            >
              <LogOut className="size-3" />
            </button>
          ) : (
            <button
              onClick={() => setLocation("/login")}
              className="ml-1 px-2 py-1.5 text-[10px]"
              title="Sign in"
            >
              <LogIn className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas */}
      <main className="flex-1 md:pt-0 pt-14 overflow-x-hidden">{children}</main>
    </div>
  );
}
