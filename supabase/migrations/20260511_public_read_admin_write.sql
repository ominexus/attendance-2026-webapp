-- 마일스톤 4-1.5: 공개 조회 + 관리자 전용 쓰기
--
-- 정책
--   attendance / students / teachers
--     - SELECT: anon, authenticated 모두 허용
--     - INSERT/UPDATE/DELETE: is_admin() 만 허용
--   profiles
--     - 기존 정책 유지 (본인 read/update + admin 전체)
--
-- 동작
--   - 비로그인 사용자도 출석부/통계/명단 조회 가능
--   - 일반 인증 사용자(teacher)도 입력 불가, 관리자(admin)만 쓰기

-- 1. 기존 쓰기 정책 정리 (이전 버전에서 만든 ALL/INSERT/UPDATE/DELETE 정책 모두 제거)
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('attendance','students','teachers')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 2. RLS 보장
alter table public.attendance enable row level security;
alter table public.students   enable row level security;
alter table public.teachers   enable row level security;

-- 3. SELECT (공개)
create policy "Public read - attendance"
  on public.attendance for select
  to anon, authenticated using (true);

create policy "Public read - students"
  on public.students for select
  to anon, authenticated using (true);

create policy "Public read - teachers"
  on public.teachers for select
  to anon, authenticated using (true);

-- 4. INSERT/UPDATE/DELETE (관리자 전용)
create policy "Admin write - attendance"
  on public.attendance for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin write - students"
  on public.students for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin write - teachers"
  on public.teachers for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
