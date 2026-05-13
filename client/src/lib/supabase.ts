import { createClient } from "@supabase/supabase-js";

// Supabase 환경변수
// - Vite는 빌드 타임에 VITE_ 접두 변수를 정적으로 치환합니다
// - GitHub Pages 배포 시 Repository Secrets에 등록 → Actions 워크플로우에서 주입
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://ovtgwbhbwtfwzgaihlmb.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  // anon 키는 공개되어도 안전 (RLS로 권한 통제). 로컬 개발 편의를 위한 fallback.
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92dGd3Ymhid3Rmd3pnYWlobG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NDQ5NDMsImV4cCI6MjA5NDAyMDk0M30.JI-bj_x1heeWbNgeeZqGARlYL6WMH-mT5reGg98_L_o";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ── 도메인 타입 정의 ────────────────────────────────────────────────────────
export interface Teacher {
  id: string;
  role: string;
  name: string;
  created_at: string;
}

export interface Student {
  id: string;
  grade: string;
  class_num: string;
  name: string;
  gender: string | null;
  phone: string | null;
  birth_date: string | null;
  school: string | null;
  guide: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  attendance_date: string; // YYYY-MM-DD
  status: boolean;
  created_at: string;
}

// 결석 사유 메모 (누구나 작성/수정 가능, 삭제는 admin만)
export interface AbsenceNote {
  id: string;
  attend_date: string; // YYYY-MM-DD
  student_id: string;
  note: string;
  author_name: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}


// 출석 가능 일자 (Weeks 관리)
export interface AttendanceDate {
  attendance_date: string; // YYYY-MM-DD (PK)
  service_type: string; // 기본 '주일예배'
  label: string | null;
  is_default_sunday: boolean;
  is_active: boolean;
  is_invite_event: boolean;
  created_at: string;
  updated_at: string;
}

// 친구초청잔치 1회성 손님
export interface Guest {
  id: string;
  name: string;
  gender: string | null; // '남' | '여' | null
  grade: number | null;
  class_num: number | null;
  inviter_student_id: string | null; // students FK (데려온 학생)
  first_visit_date: string; // YYYY-MM-DD
  note: string | null;
  promoted_student_id: string | null; // 승격된 정규 학생 ID
  is_promoted: boolean;
  created_at: string;
}

// 손님 출석
export interface GuestAttendance {
  id: string;
  guest_id: string;
  attend_date: string; // YYYY-MM-DD
  status: boolean;
  created_at: string;
}
