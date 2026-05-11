-- ================================================================
-- 결석 사유 메모 (absence_notes)
-- - attendance 테이블과 별도로 두어 RLS 권한을 분리
-- - 누구나(anon 포함) 메모를 작성/수정 가능
-- - 출석 status 자체는 기존대로 admin만 변경 가능
-- - (attend_date, student_id) UNIQUE 로 1:1 보장
-- ================================================================

create table if not exists public.absence_notes (
  id uuid primary key default gen_random_uuid(),
  attend_date date not null,
  student_id uuid not null references public.students(id) on delete cascade,
  note text not null check (length(note) <= 500),
  author_name text,                                  -- 선택: 비로그인도 작성 가능
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attend_date, student_id)
);

create index if not exists idx_absence_notes_date on public.absence_notes(attend_date);
create index if not exists idx_absence_notes_student on public.absence_notes(student_id);

-- updated_at 자동 갱신
create or replace function public.touch_absence_note_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_absence_notes_touch on public.absence_notes;
create trigger trg_absence_notes_touch
before update on public.absence_notes
for each row execute function public.touch_absence_note_updated_at();

-- RLS
alter table public.absence_notes enable row level security;

drop policy if exists "Public read - absence_notes" on public.absence_notes;
drop policy if exists "Public insert - absence_notes" on public.absence_notes;
drop policy if exists "Public update - absence_notes" on public.absence_notes;
drop policy if exists "Admin delete - absence_notes" on public.absence_notes;

-- 누구나 조회
create policy "Public read - absence_notes"
  on public.absence_notes for select
  to anon, authenticated using (true);

-- 누구나 작성
create policy "Public insert - absence_notes"
  on public.absence_notes for insert
  to anon, authenticated with check (true);

-- 누구나 수정 (덮어쓰기 허용 정책)
create policy "Public update - absence_notes"
  on public.absence_notes for update
  to anon, authenticated using (true) with check (true);

-- 삭제는 관리자만 (오·남용 정리용)
create policy "Admin delete - absence_notes"
  on public.absence_notes for delete
  to authenticated using (public.is_admin());

comment on table public.absence_notes is
  '결석 사유 메모. 누구나 작성/수정 가능, 삭제는 관리자만.';
