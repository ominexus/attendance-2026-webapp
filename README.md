# 2026 고등부 출석부 웹서비스

기존 Google Sheets 기반 출석부를 대체하는 React + Vite + Supabase 웹앱.  
GitHub Pages를 통해 정적 호스팅하며, 인증·데이터는 Supabase가 담당합니다.

**리포지토리 URL**: https://github.com/ominexus/attendance-2026-webapp

---

## 진행 현황

| 마일스톤 | 범위 | 상태 |
| --- | --- | --- |
| 1 | Supabase 프로젝트/스키마/RLS, 엑셀→DB 마이그레이션 | 완료 |
| 2 | React + Vite + Tailwind + Supabase 인증 뼈대, GitHub Pages 배포 설정 | 완료 |
| 3 | 출석 입력 UI, 통계 대시보드, 학생/인도자 관리(CSV 업로드 포함) | 완료 |
| 4-1 | 회원가입 + 관리자 초대 + role 구분(profiles + Edge Function) | 완료 |
| 4-1.5 | **공개 조회 + 관리자 전용 입력** (RLS public read / admin write) | 완료 |
| 4-2 | UI 단순화: Guest/Admin 2모드, 회원가입/초대 UI 제거 | 완료 |
| 4-3 | **결석 사유 메모** (absence_notes, 누구나 입력 가능) | **완료** |
| 4-4 | **Pass Code 단축 로그인** (/access, VITE_PASS_CODE 검증 후 자동 signIn) | **완료** |
| 4-5 | 용어 업데이트: '지도교사' → '인도자' | 완료 |
| 4-6 | **반별/남여 그룹핑 UI** (Home 출석 입력 화면, 성별 선택 필드 Roster 추가) | **완료** |
| 4-7 | **행동 지표 전환** (출석률 제거 → 출석·결석·메모 카운트, Stats KPI 재구성) | **완료** |
| 4-8 | **활동학생(is_active) 기능** (DB 마이그레이션, Home 필터링+자동 승격, Roster 토글, Stats 보정) | **완료** |
| 4-9 | **이력 패널 + 비활동 후보 기능** (StudentHistoryPanel, Home 카드 이름 클릭, Roster 행 클릭, 비활동 후보 모달) | **완료** |
| 4-10 | 알림, 반별 권한 분리 | 예정 |
| 4-11 | 새로고침 무한 로딩 스피너 버그 수정 (AuthContext onAuthStateChange 단일 경로 정리) | 완료 |
| 4-12 | 학생 인라인 편집 + Stats 기준일 컨트롤 + 학년별 통계 | 완료 |
| 4-13 | 전역 날짜 컨텍스트(SelectedDateContext) + URL ?date= 양방향 동기화 | 완료 |
| 4-14 | DateSpinner 교체 (attendance 기록 기반 select 스피너) | 완료 |
| 4-15 | DateSpinner 2026년 필터 + 기본값 자동 보정 | 완료 |
| 4-16 | DateSpinner 기본값 자동 보정 (URL 날짜가 목록에 없으면 최신 날짜로 보정) | 완료 |
| 4-17 | attendance_dates 테이블 + DateSpinner 소스 전환 + 주간 관리 페이지(/weeks) | 완료 |
| 4-22 | **친구초청 손님 관리** (guests + guest_attendance, 초청주 플래그, 손님 추가/출석/승격, 출석 이력 소급 이전) | **완료** |

---

## 디렉터리 구조

```text
attendance-2026-webapp/
├── docs/
│   └── deploy.yml.example         # GitHub Actions 워크플로우 (수동 등록 필요 - 아래 안내 참조)
├── client/                        # React + Vite 프론트엔드
│   ├── index.html
│   └── src/
│       ├── App.tsx                # 라우팅 + Provider 조립
│       ├── components/AppLayout.tsx  # 사이드바 + 모바일 상단 네비
│       ├── contexts/AuthContext.tsx
│       ├── lib/supabase.ts        # Supabase 클라이언트 & 도메인 타입
│       ├── pages/PassCode.tsx     # Pass Code 입력 페이지 (/access)
│       ├── pages/Login.tsx        # 로그인 페이지 (직접 URL 접근 전용)
│       ├── pages/Home.tsx         # 출석 입력 (도장 토글 + Optimistic UI)
│       ├── pages/Stats.tsx        # 통계 대시보드 (Recharts)
│       ├── pages/Roster.tsx       # 학생/인도자 CRUD + CSV·XLSX 일괄 등록
├── supabase/
│   ├── schema.sql                  # M1 스키마/인덱스/RLS/뷰
│   ├── migrations/
│   │   ├── 20260511_profiles_and_invites.sql  # M4-1: profiles 테이블 + role + 트리거
│   │   ├── 20260511_public_read_admin_write.sql # M4-1.5: 공개 조회 + 관리자 쓰기 정책
│   │   └── 20260511_absence_notes.sql      # M4-3: 결석 사유 메모 테이블 + public RLS
│   └── functions/
│       └── invite-user/index.ts    # M4-1: 관리자 전용 초대 Edge Function
├── scripts/
│   ├── migrate.py                 # REST API 기반 마이그레이션
│   └── migrate_via_mcp.py         # MCP 기반 마이그레이션 (M1 실사용)
├── server/                        # 정적 호스팅용 더미 (Pages에서는 미사용)
├── vite.config.ts                 # VITE_BASE 환경변수로 Pages 경로 prefix 제어
├── package.json
└── project_plan.md
```

---

## 로컬 개발 환경 설정

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 환경변수 설정 (선택)

기본값이 `client/src/lib/supabase.ts`에 fallback으로 내장되어 있어 별도 설정 없이도 동작합니다.  
다른 Supabase 인스턴스를 사용하려면 프로젝트 루트에 `.env.local` 파일을 생성하세요.

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
# Pass Code 단축 로그인 (로컬 개발 시 직접 입력)
VITE_PASS_CODE=your-pass-code
VITE_ADMIN_EMAIL=admin@example.com
VITE_ADMIN_PASSWORD=your-admin-password
```

### 3. 개발 서버 실행

```bash
pnpm dev
# → http://localhost:3000
```

### 4. 빌드

```bash
# GitHub Pages용 정적 빌드 (dist/public/)
pnpm build:pages

# 로컬 서버 포함 전체 빌드
pnpm build
```

---

## GitHub Pages 자동 배포 활성화 (수동 작업 필요)

GitHub App 토큰의 `workflows` 권한 제한으로 인해 워크플로우 파일을 자동 push할 수 없습니다.  
아래 단계를 직접 수행해 주세요.

### Step 1. GitHub Pages 소스 설정

1. 리포지토리 → **Settings** → **Pages**
2. **Source**를 `GitHub Actions`로 변경 후 저장

### Step 2. Repository Secrets 등록

1. 리포지토리 → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**으로 다음 두 개 등록:

| Secret 이름 | 값 |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://ovtgwbhbwtfwzgaihlmb.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase 프로젝트의 anon key |
| `PASS_CODE` | 관리자 입장 코드 (자유롭게 설정) |
| `ADMIN_EMAIL` | Supabase 관리자 계정 이메일 |
| `ADMIN_PASSWORD` | Supabase 관리자 계정 비밀번호 |

> **보안 메모**: `VITE_*` 값은 빌드 번들에 포함되어 소스 확인 시 노출됩니다. 이 방식은 "단축 로그인" 편의 기능이며, 실 데이터 보호는 Supabase RLS 정책이 담당합니다. Pass Code 유출 시 관리자 비밀번호를 변경하면 됩니다.

### Step 3. 워크플로우 파일 추가

리포지토리 웹 UI에서 직접 추가합니다.

1. 리포지토리 → **Actions** 탭 → **New workflow** → **set up a workflow yourself**
2. 파일 경로를 `.github/workflows/deploy.yml`로 지정
3. 아래 YAML 전체를 붙여넣고 **Commit changes**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.4.1

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --no-frozen-lockfile

      - name: Build
        env:
          VITE_BASE: /${{ github.event.repository.name }}/
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_PASS_CODE: ${{ secrets.PASS_CODE }}
          VITE_ADMIN_EMAIL: ${{ secrets.ADMIN_EMAIL }}
          VITE_ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}
        run: pnpm build:pages

      - name: SPA fallback (copy index.html → 404.html)
        run: cp dist/public/index.html dist/public/404.html

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist/public

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

동일한 YAML이 `docs/deploy.yml.example`에도 저장되어 있습니다.

### Step 4. 배포 확인

워크플로우 실행 후 배포 URL:  
`https://ominexus.github.io/attendance-2026-webapp/`

---

## Supabase 스키마 적용

```bash
# Supabase Dashboard → SQL Editor에서 실행하거나
psql "$DATABASE_URL" -f supabase/schema.sql
```

스키마 적용 후 1회만 데이터 마이그레이션(아래) 실행.

---

## 엑셀 → Supabase 마이그레이션

```bash
pip install openpyxl requests

export SUPABASE_URL="https://ovtgwbhbwtfwzgaihlmb.supabase.co"
export SUPABASE_KEY="<service_role_key>"   # anon 아님

# Dry-run
python3 scripts/migrate.py --excel-path "2026 고등부 출석부.xlsx" --dry-run

# 실제 실행
python3 scripts/migrate.py --excel-path "2026 고등부 출석부.xlsx"
```

마일스톤 1에서 `scripts/migrate_via_mcp.py`로 교사 17명, 학생 66명, 출석 기록 749건 적재 완료.

---

## 라우팅

| 경로 | 페이지 | 비로그인 조회 | 입력 |
| --- | --- | --- | --- |
| `/` | 출석 (도장 토글 + Optimistic UI) | O | admin 만 |
| `/stats` | 주차별/반별 출석 통계 대시보드 | O | 읽기 전용 |
| `/roster` | 학생/인도자 명단 | O | admin 만 (입력/편집/삭제/일괄등록 버튼은 admin에서만 표시) |
| `/login` | 이메일/패스워드 로그인 | O | - |
| `/signup` | 인도자 자마 가입 | O (직접 URL 접근 시만 노출, UI 진입점 제거) | - |
| `/set-password` | 초대 링크 수락 후 비밀번호 설정 | O (직접 URL 접근 시만, 초대 토큰 필요) | - |

### 주요 기능

**출석 입력 (`/`)**

- 기본값: 가장 최근 일요일 (상단 좌우 화살표로 주단위 이동)
- 필터: 학년 / 반
- 학생 카드 클릭 시 도장 애니메이션, Supabase에 즉시 upsert
- 네트워크 실패 시 상태 자동 롤백

**통계 (`/stats`)**

- KPI 카드: 등록 학생 / 진행 주차 / 누적 출석 / 전체 출석률
- 주차별 출석 인원 추이 (Line)
- 반별 출석률 비교 (Bar)
- 개인별 출석 상위 10명 테이블

**출석 입력 (`/`)**

- 학생 카드를 **반별 → 남/여** 순서로 그룹핑
- 반 헤더: 반 이름 + 전체 출석/인원 카운트
- 성별 서브헤더: 남(연청색)/여(분홍계) 배지 + 성별별 출석/인원 카운트
- 성별 미입력 학생은 '미지정' 그룹으로 분류

**명단 관리 (`/roster`)**

- 학생/인도자 탭 전환, 이름·학교·반 검색
- 행 명 삽입/수정/삭제 다이얼로그 (성별 선택 필드 포함)
- 엑셀/CSV 파일을 통한 일괄 생성 (한글 헤더 자동 매핑, 템플릿 다운로드 제공)

---

## 디자인 시스템

**Devotional Editorial** 컨셉. 페이퍼 톤 배경(`oklch(0.97 0.012 85)`)에 잉크 블루 액센트(`oklch(0.32 0.05 250)`), 본문 `Pretendard Variable`, 디스플레이 `Fraunces italic`. 출석 토글은 마일스톤 3에서 도장(stamp) 메타포로 구현 예정.

---

## 인증/권한 (마일스톤 4-1 / 4-1.5)

### 정책 모델

| 테이블 | SELECT | INSERT/UPDATE | DELETE |
| --- | --- | --- | --- |
| `attendance`, `students`, `teachers` | anon + authenticated | `is_admin()` 만 | `is_admin()` 만 |
| `profiles` | 본인 + admin | 본인 UPDATE(역할 제외) + admin 전체 | admin |
| **`absence_notes`** | **anon + authenticated** | **anon + authenticated (누구나)** | **`is_admin()` 만** |
결과:

- 비로그인 방문자도 출석/통계/명단을 그대로 조회 가능 (열람용 공개 사이트로 사용 가능)
- 일반 인증 사용자(teacher 역할)도 쓰기 불가 — 관리자(admin)만 출석 입력/명단 수정/일괄 업로드/초대 가능
- 프론트엔드는 `useAuth().isAdmin` 으로 입력 UI(도장 토글, +/편집/삭제, 일괄 등록, 사용자 계정 탭)를 분기 표시

### 구조

- `auth.users` ↔ `public.profiles` (1:1, 가입 시 트리거로 자동 생성)
- `profiles.role`: `admin` | `teacher` (기본 `teacher`)
- `is_admin()` SECURITY DEFINER 함수로 RLS 가드

### 회원가입 흐름

1. `/signup` 에서 이메일·비밀번호 입력
2. Supabase Auth 이메일 확인 활성 여부에 따라 동작
   - 활성: 링크 클릭 → 자동 로그인
   - 비활성: 즉시 로그인 가능
3. 트리거가 `profiles` 생성, role 은 `teacher` 고정

### 관리자 초대 흐름

1. 관리자로 로그인 → `/roster` → "사용자 계정" 탭
2. 이메일/이름/역할 입력 후 초대
3. 내부적으로 Edge Function `invite-user` 호출 → service_role 로 `inviteUserByEmail`
4. 수신자는 메일 링크 → `/set-password` → 로그인

### 필수 설정

**Supabase Dashboard:**

- Authentication > URL Configuration:
  - Site URL: `https://ominexus.github.io/attendance-2026-webapp`
  - Redirect URLs: 위 도메인 추가
- Edge Functions 환경변수:
  - `APP_PUBLIC_URL=https://ominexus.github.io/attendance-2026-webapp`

**첫 관리자 지정** (처음 1회, SQL Editor):

```sql
update public.profiles set role='admin' where email='admin@example.com';
```

---

## 결석 사유 메모 (마일스톤 4-3)

결석한 학생의 사유를 기록하는 기능. 출석 토글과는 별도의 RLS 권한을 갖습니다.

### 데이터 모델

- 테이블: `public.absence_notes`
- `(attend_date, student_id)` UNIQUE → 일/학생 당 1건
- `note` 최대 500자, `author_name` 선택값 (로그인 시 프로필 displayName 또는 email 자동 기록)
- `updated_at` 자동 갱신 트리거

### RLS

- SELECT/INSERT/UPDATE: `anon, authenticated` 모두 허용
- DELETE: `is_admin()` 만 허용 (오·남용 정리용)

### UI 동작

- `/` 출석 페이지: **결석 카드**에만 메모 입력 영역 노출. 누구나 작성 가능 (비로그인 포함). Ctrl+Enter/Enter 키 저장, Optimistic UI + 실패 시 롤백
- `/stats`: 하단에 "Absence Notes" 섹션 추가. 최근 50건 날짜·학생·사유·작성자 표시
- 메모 쓰기는 출석 입력(admin 전용)과 별도 흐름으로 작동 → Guest도 사유만 입력 가능

---

## 친구초청 손님 관리 (마일스톤 4-22)

친구초청잔치 같은 1회성 출석 손님을 관리하고, 정기 출석 시 정규 학생으로 반자동 승격하는 기능.

### 데이터 모델

- `attendance_dates.is_invite_event` (boolean, default false): 친구초청 주임을 표시하는 플래그
- `public.guests`: 1회성 손님 마스터
  - `name` 필수, `gender/grade/class_num/note` 옵션
  - `inviter_student_id` (students FK): 데려온 학생
  - `first_visit_date`: 최초 방문 일요일
  - `is_promoted/promoted_student_id`: 정규 승격 여부 + 연결된 학생
- `public.guest_attendance`: 손님 출석 기록 (`(guest_id, attend_date)` UNIQUE)
  - 출석 테이블과 분리 → 정규 학생 통계 오염 방지

### RLS

| 테이블 | SELECT | INSERT/UPDATE | DELETE |
| --- | --- | --- | --- |
| `guests`, `guest_attendance` | anon + authenticated | `is_admin()` 만 | `is_admin()` 만 |

### 승격 흐름 (반자동)

1. `/roster` → 초청 손님 탭에서 `[정규 학생으로 승격]` 클릭
2. 모달에서 학년/반/성별/연락처/생년월일/학교 입력 (이름/데려온 친구 자동 채움)
3. 트랜잭션:
   - `students` INSERT (`guide` 필드에 inviter 학생명 자동 복사)
   - `guest_attendance` → `attendance` 소급 이전 (status=true 만, 동일 날짜 중복은 무시)
   - `guests.is_promoted=true`, `promoted_student_id` 연결
4. 승격 후 통계/출석 화면에서 정규 학생 출석으로 누적

### UI

- **`/weeks`**: 일자 행에 "친구초청" 토글 컬럼 추가 (admin만)
- **`/`(Home)**: 초청주에는 정규 학생 그리드 아래에 "초청 손님" 섹션 + `[+ 손님 추가]` 모달 + 도장 토글 + 메모. 일반 주에는 미노출.
- **`/roster` 초청 손님 탭**: 미승격 손님 목록(이름/데려온 친구/학년반/성별/첫 방문일/출석 횟수/메모) + 승격/삭제 버튼
- **`/stats`**: 초청주에만 "Friend Invitation Week" KPI 박스 추가 (손님 출석 수, 정규+손님 합산)

---

## 다음 단계 (마일스톤 4-4 이후)

- 주간 출석 마감 알림 (Edge Function + Push)
- 반별 담당 인도자 쓰기 권한 분리 (admin 외에도 자기 반만 입력 허용)
- 메모 스팸 방지(시간당 제한 / 최소 길이)
- 출결 통계 PDF/CSV 내보내기
