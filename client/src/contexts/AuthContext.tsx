// 마일스톤 4: profile/role 로드, signUp, updatePassword 추가
// 버그 수정 (Milestone 4-11): 새로고침 시 loading 무한 스피너
//   - getSession + onAuthStateChange 이중 초기화 경쟁 조건 제거
//   - onAuthStateChange INITIAL_SESSION 이벤트로 단일 초기화 경로 통일
//   - loadProfile에 try/finally 적용으로 setLoading(false) 보장
import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { syncStoredSession } from "@/lib/authSession";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  role: "admin" | "teacher";
  created_at: string;
  updated_at: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  const loadProfile = useCallback(async (userId: string | null) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    console.log("[Auth] Fetching profile for:", userId);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) {
        console.warn("[Auth] Profile load error:", error.message);
        setProfile(null);
      } else {
        console.log("[Auth] Profile loaded:", data?.role);
        setProfile(data as Profile | null);
      }
    } catch (err) {
      console.warn("[Auth] Profile load exception:", err);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    console.log("[Auth] Subscribing to onAuthStateChange...");
    
    // INITIAL_SESSION 이벤트를 포함한 모든 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log(`[Auth] Event: ${event}, Session: ${newSession ? "Present" : "None"}`);
        setSession(newSession);

        if (newSession?.user.id) {
          await loadProfile(newSession.user.id);
        } else {
          setProfile(null);
        }

        if (!initializedRef.current) {
          console.log("[Auth] First meaningful state resolved");
          initializedRef.current = true;
          setLoading(false);
        }
      }
    );

    // 5초 후에도 초기화가 안 되면 강제 해제 (최후의 수단)
    const timer = setTimeout(() => {
      if (!initializedRef.current) {
        console.warn("[Auth] Initialization timed out - force clearing loader");
        initializedRef.current = true;
        setLoading(false);
      }
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName ?? null, role: "teacher" },
        emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
      },
    });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    await loadProfile(session?.user.id ?? null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        isAdmin: profile?.role === "admin",
        loading,
        signIn,
        signUp,
        signOut,
        updatePassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
