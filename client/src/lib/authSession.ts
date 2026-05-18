import type { Session } from "@supabase/supabase-js";

interface SyncStoredSessionOptions<Profile> {
  getSession: () => Promise<{
    data: { session: Session | null };
    error: Error | null;
  }>;
  loadProfile: (userId: string) => Promise<void>;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
}

export type SyncStoredSessionResult = "session" | "empty" | "error";

export async function syncStoredSession<Profile>({
  getSession,
  loadProfile,
  setSession,
  setProfile,
}: SyncStoredSessionOptions<Profile>): Promise<SyncStoredSessionResult> {
  const { data, error } = await getSession();

  if (error) {
    console.warn("session recovery error", error.message);
    return "error";
  }

  const session = data.session;
  setSession(session);

  if (!session?.user.id) {
    setProfile(null);
    return "empty";
  }

  await loadProfile(session.user.id);
  return "session";
}
