export function shouldFetchAttendanceDates(authLoading: boolean): boolean {
  return !authLoading;
}
