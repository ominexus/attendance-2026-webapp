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
  try {
    const { data, error } = await query();
    return { label, data: data ?? [], error: error?.message ?? null };
  } catch (err) {
    return { label, data: [], error: errorMessage(err) };
  }
}

export async function loadHomeAttendanceData(
  _date: string,
  queries: HomeAttendanceQueries,
): Promise<HomeAttendanceLoadResult> {
  // Use sequential queries instead of Promise.all to avoid potential race conditions
  // in browser extensions or environment listeners (e.g. "message channel closed" errors).
  const attRes = await runQuery("출석", queries.attendance);
  const noteRes = await runQuery("메모", queries.notes);
  const guestRes = await runQuery("새친구", queries.guests);
  const gAttRes = await runQuery("새친구 출석", queries.guestAttendance);

  const [res1, res2, res3, res4] = [attRes, noteRes, guestRes, gAttRes];

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
