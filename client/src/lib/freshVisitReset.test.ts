import { describe, expect, it, vi } from "vitest";
import {
  isReloadNavigation,
  resetBrowserStateForFreshVisit,
  shouldPreserveLocalStorageKey,
} from "./freshVisitReset";

class MemoryStorage {
  private data = new Map<string, string>();

  get length() {
    return this.data.size;
  }

  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null;
  }

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.data.set(key, value);
  }

  removeItem(key: string) {
    this.data.delete(key);
  }

  clear() {
    this.data.clear();
  }
}

describe("fresh visit reset", () => {
  it("preserves only Supabase auth localStorage keys", () => {
    expect(shouldPreserveLocalStorageKey("sb-ovtgwbhbwtfwzgaihlmb-auth-token")).toBe(true);
    expect(shouldPreserveLocalStorageKey("attendance.selectedDate")).toBe(false);
    expect(shouldPreserveLocalStorageKey("theme")).toBe(false);
  });

  it("detects reload navigations", () => {
    expect(isReloadNavigation({ getEntriesByType: () => [{ type: "reload" }] })).toBe(true);
    expect(isReloadNavigation({ getEntriesByType: () => [{ type: "navigate" }] })).toBe(false);
  });

  it("clears app state, session storage, date query, and cookies while preserving auth", () => {
    const localStorage = new MemoryStorage();
    localStorage.setItem("sb-ovtgwbhbwtfwzgaihlmb-auth-token", "auth-json");
    localStorage.setItem("attendance.selectedDate", "2026-05-17");
    localStorage.setItem("theme", "dark");

    const sessionStorage = new MemoryStorage();
    sessionStorage.setItem("temp", "value");

    const replaceState = vi.fn();
    const expiredCookies: string[] = [];

    resetBrowserStateForFreshVisit({
      localStorage,
      sessionStorage,
      location: {
        pathname: "/attendance-2026-webapp/",
        search: "?date=2026-05-17&foo=bar",
        hash: "#top",
      },
      history: { replaceState },
      cookie: "a=1; b=2",
      expireCookie: (cookie) => expiredCookies.push(cookie),
    });

    expect(localStorage.getItem("sb-ovtgwbhbwtfwzgaihlmb-auth-token")).toBe("auth-json");
    expect(localStorage.getItem("attendance.selectedDate")).toBeNull();
    expect(localStorage.getItem("theme")).toBeNull();
    expect(sessionStorage.length).toBe(0);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/attendance-2026-webapp/?foo=bar#top");
    expect(expiredCookies).toContain("a=; Max-Age=0; path=/");
    expect(expiredCookies).toContain("b=; Max-Age=0; path=/");
  });
});
