-- 2026 고등부 출석부 Supabase PostgreSQL 스키마

-- 1. 테이블 생성

-- 교사 명단 테이블
CREATE TABLE IF NOT EXISTS public.teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(50) NOT NULL, -- 직분 또는 담당 반 (예: '담당교역자', '1학년 1반')
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 학생 명단 테이블
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade VARCHAR(10) NOT NULL, -- 예: '1학년'
    class_num VARCHAR(10) NOT NULL, -- 예: '1반'
    name VARCHAR(50) NOT NULL,
    gender VARCHAR(10), -- '남' 또는 '여'
    phone VARCHAR(20),
    birth_date DATE,
    school VARCHAR(100),
    guide VARCHAR(50), -- 인도자
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 출석 기록 테이블
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL, -- 출석일 (일요일)
    status BOOLEAN NOT NULL DEFAULT FALSE, -- 출석 여부
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, attendance_date) -- 한 학생은 같은 날짜에 하나의 출석 기록만 가짐
);

-- 2. 인덱스 생성 (조회 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_students_grade_class ON public.students(grade, class_num);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.attendance(student_id);

-- 3. Row Level Security (RLS) 정책 설정

-- 모든 테이블에 RLS 활성화
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- 익명 사용자(비로그인)는 읽기만 가능하도록 설정
CREATE POLICY "Allow public read access on teachers" ON public.teachers FOR SELECT USING (true);
CREATE POLICY "Allow public read access on students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Allow public read access on attendance" ON public.attendance FOR SELECT USING (true);

-- 인증된 사용자(authenticated)는 모든 작업(CRUD) 가능하도록 설정
CREATE POLICY "Allow authenticated full access on teachers" ON public.teachers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access on students" ON public.students FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access on attendance" ON public.attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. 통계 뷰 생성

-- 반별 주차별 출석 인원 집계 뷰
CREATE OR REPLACE VIEW public.v_attendance_stats AS
SELECT
    s.grade,
    s.class_num,
    a.attendance_date,
    COUNT(*) FILTER (WHERE a.status = true) AS present_count,
    COUNT(*) AS total_students
FROM public.students s
LEFT JOIN public.attendance a ON a.student_id = s.id
GROUP BY s.grade, s.class_num, a.attendance_date
ORDER BY s.grade, s.class_num, a.attendance_date;

-- 학생별 출석 요약 뷰
CREATE OR REPLACE VIEW public.v_student_attendance_summary AS
SELECT
    s.id AS student_id,
    s.grade,
    s.class_num,
    s.name,
    s.gender,
    COUNT(*) FILTER (WHERE a.status = true) AS total_present,
    COUNT(*) FILTER (WHERE a.status = false) AS total_absent
FROM public.students s
LEFT JOIN public.attendance a ON a.student_id = s.id
GROUP BY s.id, s.grade, s.class_num, s.name, s.gender
ORDER BY s.grade, s.class_num, s.name;


-- ============================================================
-- M4-22: 친구초청잔치 손님 관리 (2026-05-13)
-- ============================================================

-- attendance_dates에 친구초청 주 플래그 추가
ALTER TABLE public.attendance_dates
  ADD COLUMN IF NOT EXISTS is_invite_event boolean NOT NULL DEFAULT false;

-- 1회성 손님 테이블
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

-- 손님 출석 테이블
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

ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_attendance ENABLE ROW LEVEL SECURITY;

-- 공개 SELECT
CREATE POLICY guests_select_public ON public.guests
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY guest_attendance_select_public ON public.guest_attendance
  FOR SELECT TO anon, authenticated USING (true);

-- admin only INSERT/UPDATE/DELETE
CREATE POLICY guests_admin_insert ON public.guests
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY guests_admin_update ON public.guests
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY guests_admin_delete ON public.guests
  FOR DELETE TO authenticated USING (public.is_admin());
CREATE POLICY guest_attendance_admin_insert ON public.guest_attendance
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY guest_attendance_admin_update ON public.guest_attendance
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY guest_attendance_admin_delete ON public.guest_attendance
  FOR DELETE TO authenticated USING (public.is_admin());
