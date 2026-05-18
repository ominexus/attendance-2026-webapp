import { describe, expect, it } from "vitest";
import { shouldFetchAttendanceDates } from "./selectedDateAuth";

describe("shouldFetchAttendanceDates", () => {
  it("waits until auth state is restored before resolving the date list", () => {
    expect(shouldFetchAttendanceDates(true)).toBe(false);
  });

  it("allows date list loading after auth state is known", () => {
    expect(shouldFetchAttendanceDates(false)).toBe(true);
  });
});
