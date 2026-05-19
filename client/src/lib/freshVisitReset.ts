interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

interface NavigationLike {
  getEntriesByType(type: "navigation"): Array<PerformanceEntry | { type?: string }>;
}

interface ResetLocationLike {
  pathname: string;
  search: string;
  hash: string;
}

interface ResetHistoryLike {
  replaceState(data: unknown, unused: string, url?: string | URL | null): void;
}

export interface FreshVisitResetTarget {
  localStorage: StorageLike;
  sessionStorage: StorageLike;
  location: ResetLocationLike;
  history: ResetHistoryLike;
  cookie: string;
  expireCookie: (cookie: string) => void;
}

const SUPABASE_AUTH_STORAGE_KEY = /^sb-[a-z0-9]+-auth-token$/;

export function shouldPreserveLocalStorageKey(key: string): boolean {
  return SUPABASE_AUTH_STORAGE_KEY.test(key);
}

export function isReloadNavigation(performanceLike: NavigationLike): boolean {
  const [navigation] = performanceLike.getEntriesByType("navigation");
  return (navigation as { type?: string } | undefined)?.type === "reload";
}

function resetLocalStorage(storage: StorageLike) {
  const preserved = new Map<string, string>();

  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key || !shouldPreserveLocalStorageKey(key)) continue;
    const value = storage.getItem(key);
    if (value !== null) preserved.set(key, value);
  }

  storage.clear();

  preserved.forEach((value, key) => {
    storage.setItem(key, value);
  });
}

function resetDateQuery(location: ResetLocationLike, history: ResetHistoryLike) {
  const params = new URLSearchParams(location.search);
  if (!params.has("date")) return;

  params.delete("date");
  const query = params.toString();
  const nextUrl = `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
  history.replaceState(null, "", nextUrl);
}

function expireDocumentCookies(cookie: string, expireCookie: (cookie: string) => void) {
  const names = cookie
    .split(";")
    .map((part) => part.split("=")[0]?.trim())
    .filter((name): name is string => Boolean(name));

  for (const name of names) {
    expireCookie(`${name}=; Max-Age=0; path=/`);
  }
}

export function resetBrowserStateForFreshVisit(target: FreshVisitResetTarget) {
  resetLocalStorage(target.localStorage);
  target.sessionStorage.clear();
  resetDateQuery(target.location, target.history);
  expireDocumentCookies(target.cookie, target.expireCookie);
}

export function resetBrowserStateOnReload() {
  if (!isReloadNavigation(window.performance)) return;

  resetBrowserStateForFreshVisit({
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
    location: window.location,
    history: window.history,
    cookie: document.cookie,
    expireCookie: (cookie) => {
      document.cookie = cookie;
    },
  });
}
