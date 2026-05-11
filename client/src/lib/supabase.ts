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
  created_at: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  attendance_date: string; // YYYY-MM-DD
  status: boolean;
  created_at: string;
}
