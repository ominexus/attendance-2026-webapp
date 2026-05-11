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
| 3 | 출석 입력 UI, 통계 대시보드, 학생/교사 관리 | 예정 |

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
│       ├── contexts/AuthContext.tsx
│       ├── lib/supabase.ts        # Supabase 클라이언트 & 도메인 타입
│       ├── pages/Login.tsx        # 로그인 페이지 (Devotional Editorial 디자인)
│       └── pages/Home.tsx         # 인증 후 학생 명단
├── supabase/schema.sql            # DB 스키마/인덱스/RLS/뷰
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
| `/` | 학생 명단 (마일스톤 3에서 출석 입력으로 확장) | O |
| `/login` | 이메일/패스워드 로그인 | X |

---

## 디자인 시스템

**Devotional Editorial** 컨셉. 페이퍼 톤 배경(`oklch(0.97 0.012 85)`)에 잉크 블루 액센트(`oklch(0.32 0.05 250)`), 본문 `Pretendard Variable`, 디스플레이 `Fraunces italic`. 출석 토글은 마일스톤 3에서 도장(stamp) 메타포로 구현 예정.

---

## 다음 단계 (마일스톤 3)

- 주차 선택 + 학생 카드 출석 토글 UI (도장 애니메이션)
- 출석률 통계 뷰 시각화 (recharts)
- 교사/학생 CRUD 화면
- 관리자 초대 기반 교사 계정 발급
