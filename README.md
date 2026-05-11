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
| 3 | 출석 입력 UI, 통계 대시보드, 학생/교사 관리(CSV 업로드 포함) | 완료 |
| 4-1 | 회원가입 + 관리자 초대 + role 구분(profiles + Edge Function) | 완료 |
| 4-2 | 알림, 결석 사유 메모 | 예정 |

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
│       ├── pages/Login.tsx        # 로그인 페이지
│       ├── pages/Home.tsx         # 출석 입력 (도장 토글 + Optimistic UI)
│       ├── pages/Stats.tsx        # 통계 대시보드 (Recharts)
│       └── pages/Roster.tsx       # 학생/교사 CRUD + CSV·XLSX 일괄 등록
├── supabase/
│   ├── schema.sql                  # M1 스키마/인덱스/RLS/뷰
│   ├── migrations/
│   │   └── 20260511_profiles_and_invites.sql  # M4-1: profiles 테이블 + role + 트리거
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

| 경로 | 페이지 | 인증 필요 |
| --- | --- | --- |
| `/` | 출석 입력 (도장 토글 + Optimistic UI) | O |
| `/stats` | 주차별/반별 출석 통계 대시보드 | O |
| `/roster` | 학생/교사 CRUD + 사용자 계정 탭(관리자용 초대/role 변경) | O |
| `/login` | 이메일/패스워드 로그인 | X |
| `/signup` | 교사 자마 가입 | X |
| `/set-password` | 초대 링크 수락 후 비밀번호 설정 | X (초대 토큰으로 자동 로그인) |

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

**명단 관리 (`/roster`)**

- 학생/교사 탭 전환, 이름·학교·반 검색
- 행 명 삽입/수정/삭제 다이얼로그
- 엑셀/CSV 파일을 통한 일괄 생성 (한글 헤더 자동 매핑, 템플릿 다운로드 제공)

---

## 디자인 시스템

**Devotional Editorial** 컨셉. 페이퍼 톤 배경(`oklch(0.97 0.012 85)`)에 잉크 블루 액센트(`oklch(0.32 0.05 250)`), 본문 `Pretendard Variable`, 디스플레이 `Fraunces italic`. 출석 토글은 마일스톤 3에서 도장(stamp) 메타포로 구현 예정.

---

## 인증/권한 (마일스톤 4-1)

### 구조

- `auth.users` ↔ `public.profiles` (1:1, 가입 시 트리거로 자동 생성)
- `profiles.role`: `admin` | `teacher` (기본 `teacher`)
- `is_admin()` SQL 함수 + RLS:
  - profiles: 본인만 SELECT/UPDATE, admin 은 전체 SELECT/UPDATE/DELETE
  - role 변경은 admin 만 가능

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

## 다음 단계 (마일스톤 4-2 이후)

- 결석 사유 메모 필드
- 주간 출석 마감 알림 (Edge Function + Push)
- 반별 담당 교사 권한 구분
