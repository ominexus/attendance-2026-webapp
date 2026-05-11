-- 마일스톤 4(2번): 회원가입 + 관리자 초대
--
-- 설계 메모
-- - auth.users 와 1:1 매핑되는 public.profiles 테이블
-- - role 컬럼: 'admin' | 'teacher' (기본 teacher)
-- - 신규 가입 시 트리거로 profiles 행 자동 생성
-- - is_admin() 헬퍼 + RLS 강화 (학생/교사/출석 쓰기는 admin 또는 teacher 모두 허용,
--   profiles 본인 행만 SELECT/UPDATE, role 변경은 admin만)

-- 1. profiles 테이블
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'teacher' check (role in ('admin','teacher')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);

-- 2. updated_at 자동 갱신
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 3. 신규 가입자 → profiles 자동 생성 트리거
-- raw_user_meta_data.role 가 명시되면 그 값을, 아니면 'teacher'
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role', 'teacher')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. 기존 사용자 백필 (없으면 무시)
insert into public.profiles (id, email, display_name, role)
select u.id,
       u.email,
       coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email,'@',1)),
       coalesce(u.raw_user_meta_data->>'role', 'teacher')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- 5. is_admin 헬퍼
create or replace function public.is_admin() returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

-- 6. RLS
alter table public.profiles enable row level security;

drop policy if exists "Profiles - self read" on public.profiles;
create policy "Profiles - self read" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Profiles - admin read all" on public.profiles;
create policy "Profiles - admin read all" on public.profiles
  for select using (public.is_admin());

drop policy if exists "Profiles - self update (no role)" on public.profiles;
create policy "Profiles - self update (no role)" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

drop policy if exists "Profiles - admin update" on public.profiles;
create policy "Profiles - admin update" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Profiles - admin delete" on public.profiles;
create policy "Profiles - admin delete" on public.profiles
  for delete using (public.is_admin());

-- 7. 첫 관리자 지정: ominexus@페이지원 운영자가 직접 설정
--    (운영 환경에서는 SQL Editor에서 다음 명령으로 부여)
--    update public.profiles set role='admin' where email='관리자이메일@example.com';
