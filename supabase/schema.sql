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
