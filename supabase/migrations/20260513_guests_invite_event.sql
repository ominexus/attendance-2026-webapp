-- Phase 1: 친구초청 손님(guests) 관리 기능 마이그레이션

-- 1) attendance_dates에 친구초청 주 플래그 추가
ALTER TABLE public.attendance_dates
  ADD COLUMN IF NOT EXISTS is_invite_event boolean NOT NULL DEFAULT false;

-- 2) guests 테이블 (1회성 손님)
CREATE TABLE IF NOT EXISTS public.guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  gender text NULL,
  grade integer NULL,
  class_num integer NULL,
  inviter_student_id uuid NULL REFERENCES public.students(id) ON DELETE SET NULL,
  first_visit_date date NOT NULL,
  note text NULL,
  promoted_student_id uuid NULL REFERENCES public.students(id) ON DELETE SET NULL,
  is_promoted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guests_first_visit_date ON public.guests(first_visit_date);
CREATE INDEX IF NOT EXISTS idx_guests_inviter ON public.guests(inviter_student_id);
CREATE INDEX IF NOT EXISTS idx_guests_promoted ON public.guests(is_promoted);

-- 3) guest_attendance 테이블
CREATE TABLE IF NOT EXISTS public.guest_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  attend_date date NOT NULL,
  status boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guest_id, attend_date)
);

CREATE INDEX IF NOT EXISTS idx_guest_attendance_date ON public.guest_attendance(attend_date);
CREATE INDEX IF NOT EXISTS idx_guest_attendance_guest ON public.guest_attendance(guest_id);

-- 4) RLS 활성화
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_attendance ENABLE ROW LEVEL SECURITY;

-- 5) 정책: 공개 SELECT
DROP POLICY IF EXISTS guests_select_public ON public.guests;
CREATE POLICY guests_select_public ON public.guests
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS guest_attendance_select_public ON public.guest_attendance;
CREATE POLICY guest_attendance_select_public ON public.guest_attendance
  FOR SELECT TO anon, authenticated
  USING (true);

-- 6) 정책: admin only INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS guests_admin_insert ON public.guests;
CREATE POLICY guests_admin_insert ON public.guests
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS guests_admin_update ON public.guests;
CREATE POLICY guests_admin_update ON public.guests
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS guests_admin_delete ON public.guests;
CREATE POLICY guests_admin_delete ON public.guests
  FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS guest_attendance_admin_insert ON public.guest_attendance;
CREATE POLICY guest_attendance_admin_insert ON public.guest_attendance
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS guest_attendance_admin_update ON public.guest_attendance;
CREATE POLICY guest_attendance_admin_update ON public.guest_attendance
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS guest_attendance_admin_delete ON public.guest_attendance;
CREATE POLICY guest_attendance_admin_delete ON public.guest_attendance
  FOR DELETE TO authenticated
  USING (public.is_admin());
