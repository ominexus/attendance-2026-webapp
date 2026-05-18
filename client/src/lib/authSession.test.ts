import { describe, expect, it, vi } from "vitest";
import { syncStoredSession } from "./authSession";

describe("syncStoredSession", () => {
  it("loads the stored session and profile when a session exists", async () => {
    const session = { user: { id: "user-1" } };
    const getSession = vi.fn().mockResolvedValue({ data: { session }, error: null });
    const loadProfile = vi.fn().mockResolvedValue(undefined);
    const setSession = vi.fn();
    const setProfile = vi.fn();

    const result = await syncStoredSession({
      getSession,
      loadProfile,
      setSession,
      setProfile,
    });

    expect(result).toBe("session");
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(setSession).toHaveBeenCalledWith(session);
    expect(loadProfile).toHaveBeenCalledWith("user-1");
    expect(setProfile).not.toHaveBeenCalled();
  });

  it("clears local auth state when storage has no session", async () => {
    const getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
    const loadProfile = vi.fn();
    const setSession = vi.fn();
    const setProfile = vi.fn();

    const result = await syncStoredSession({
      getSession,
      loadProfile,
      setSession,
      setProfile,
    });

    expect(result).toBe("empty");
    expect(setSession).toHaveBeenCalledWith(null);
    expect(setProfile).toHaveBeenCalledWith(null);
    expect(loadProfile).not.toHaveBeenCalled();
  });

  it("keeps current state when session recovery fails", async () => {
    const getSession = vi.fn().mockResolvedValue({
      data: { session: null },
      error: new Error("network unavailable"),
    });
    const loadProfile = vi.fn();
    const setSession = vi.fn();
    const setProfile = vi.fn();

    const result = await syncStoredSession({
      getSession,
      loadProfile,
      setSession,
      setProfile,
    });

    expect(result).toBe("error");
    expect(setSession).not.toHaveBeenCalled();
    expect(setProfile).not.toHaveBeenCalled();
  });
});
