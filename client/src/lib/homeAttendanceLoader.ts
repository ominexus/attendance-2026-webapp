import type { AbsenceNote, Attendance, Guest, GuestAttendance } from "@/lib/supabase";

type QueryResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

interface HomeAttendanceQueries {
  attendance: () => PromiseLike<QueryResult<Attendance>>;
  notes: () => PromiseLike<QueryResult<AbsenceNote>>;
  guests: () => PromiseLike<QueryResult<Guest>>;
  guestAttendance: () => PromiseLike<QueryResult<GuestAttendance>>;
}

export interface HomeAttendanceLoadError {
  label: string;
  message: string;
}

export interface HomeAttendanceLoadResult {
  attendance: Map<string, Attendance>;
  notes: Map<string, AbsenceNote>;
  guests: Guest[];
  guestAttendance: Map<string, GuestAttendance>;
  errors: HomeAttendanceLoadError[];
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "알 수 없는 오류";
}

async function runQuery<T>(
  label: string,
  query: () => PromiseLike<QueryResult<T>>,
): Promise<{ label: string; data: T[]; error: string | null }> {
  console.log(`[Loader] Starting query: ${label}`);
  try {
    const { data, error } = await query();
    if (error) {
      console.warn(`[Loader] Query error [${label}]:`, error.message);
    } else {
      console.log(`[Loader] Query success [${label}]: ${data?.length ?? 0} items`);
    }
    return { label, data: data ?? [], error: error?.message ?? null };
  } catch (err) {
    console.error(`[Loader] Query exception [${label}]:`, err);
    return { label, data: [], error: errorMessage(err) };
  }
}

export async function loadHomeAttendanceData(
  _date: string,
  queries: HomeAttendanceQueries,
): Promise<HomeAttendanceLoadResult> {
  const [attRes, noteRes, guestRes, gAttRes] = await Promise.all([
    runQuery("출석", queries.attendance),
    runQuery("메모", queries.notes),
    runQuery("새친구", queries.guests),
    runQuery("새친구 출석", queries.guestAttendance),
  ]);

  const attendance = new Map<string, Attendance>();
  for (const a of attRes.data) attendance.set(a.student_id, a);

  const notes = new Map<string, AbsenceNote>();
  for (const n of noteRes.data) notes.set(n.student_id, n);

  const guestAttendance = new Map<string, GuestAttendance>();
  for (const ga of gAttRes.data) guestAttendance.set(ga.guest_id, ga);

  const errors = [attRes, noteRes, guestRes, gAttRes]
    .filter((res) => res.error)
    .map((res) => ({ label: res.label, message: res.error! }));

  return {
    attendance,
    notes,
    guests: guestRes.data,
    guestAttendance,
    errors,
  };
}
