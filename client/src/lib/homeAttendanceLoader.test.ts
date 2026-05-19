import { describe, expect, it } from "vitest";
import { loadHomeAttendanceData } from "./homeAttendanceLoader";

describe("loadHomeAttendanceData", () => {
  it("returns attendance state when all queries succeed", async () => {
    const result = await loadHomeAttendanceData("2026-05-17", {
      attendance: async () => ({ data: [{ id: "a1", student_id: "s1", attendance_date: "2026-05-17", status: true, created_at: "" }], error: null }),
      notes: async () => ({ data: [{ id: "n1", attend_date: "2026-05-17", student_id: "s1", note: "memo", author_name: null, author_id: null, created_at: "", updated_at: "" }], error: null }),
      guests: async () => ({ data: [{ id: "g1", name: "guest", gender: null, grade: null, class_num: null, inviter_student_id: null, first_visit_date: "2026-05-17", note: null, promoted_student_id: null, is_promoted: false, created_at: "" }], error: null }),
      guestAttendance: async () => ({ data: [{ id: "ga1", guest_id: "g1", attend_date: "2026-05-17", status: true, created_at: "" }], error: null }),
    });

    expect(result.attendance.get("s1")?.status).toBe(true);
    expect(result.notes.get("s1")?.note).toBe("memo");
    expect(result.guests).toHaveLength(1);
    expect(result.guestAttendance.get("g1")?.status).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("captures thrown query failures instead of leaving the caller stuck loading", async () => {
    const result = await loadHomeAttendanceData("2026-05-17", {
      attendance: async () => { throw new Error("network blocked"); },
      notes: async () => ({ data: [], error: null }),
      guests: async () => ({ data: [], error: null }),
      guestAttendance: async () => ({ data: [], error: null }),
    });

    expect(result.errors).toEqual([
      { label: "출석", message: "network blocked" },
    ]);
  });
});
