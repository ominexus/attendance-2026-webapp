// Devotional Editorial 공통 레이아웃
// - 좌측 narrow rail에 네비게이션 (잉크 블루 배경)
// - 우측 wide canvas (페이퍼 톤 배경)
// - 상단 magazine masthead
import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Stamp, BarChart3, Users, Loader2 } from "lucide-react";
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
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [loading, user, setLocation]);

  if (loading || !user) {
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
          <div className="font-display italic text-2xl mt-1 leading-tight">고등부<br />출석부</div>
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
          <div className="text-[10px] uppercase tracking-wider opacity-50">서명자</div>
          <div className="text-xs truncate">{user.email}</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start gap-2 text-xs uppercase tracking-wider text-white/70 hover:text-white hover:bg-white/10 px-2"
          >
            <LogOut className="size-3.5" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-[oklch(0.32_0.05_250)] text-[oklch(0.97_0.012_85)] flex items-center justify-between px-4 py-3">
        <div className="font-display italic text-base">고등부 출석부</div>
        <div className="flex gap-1">
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
        </div>
      </div>

      {/* Main Canvas */}
      <main className="flex-1 md:pt-0 pt-14 overflow-x-hidden">{children}</main>
    </div>
  );
}
