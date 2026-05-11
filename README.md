# 2026 고등부 출석부 웹서비스

기존 Google Sheets 기반 출석부를 대체하는 React + Vite + Supabase 웹앱. GitHub Pages를 통해 정적 호스팅하며, 인증·데이터는 Supabase가 담당합니다.

## 진행 현황

| 마일스톤 | 범위 | 상태 |
| --- | --- | --- |
| 1 | Supabase 프로젝트/스키마/RLS, 엑셀→DB 마이그레이션 | 완료 |
| 2 | React + Vite + Tailwind + Supabase 인증 뼈대, GitHub Pages 자동 배포 | 완료 |
| 3 | 출석 입력 UI, 통계 대시보드, 학생/교사 관리 | 예정 |

## 디렉터리 구조

```text
attendance-2026-webapp/
├── .github/workflows/deploy.yml   # GitHub Pages 자동 배포 워크플로우
├── client/                        # React + Vite 프론트엔드
│   ├── index.html
│   └── src/
│       ├── App.tsx                # 라우팅 + Provider 조립
│       ├── contexts/AuthContext.tsx
│       ├── lib/supabase.ts        # Supabase 클라이언트 & 도메인 타입
│       ├── pages/Login.tsx        # 로그인 페이지
│       └── pages/Home.tsx         # 인증 후 학생 명단
├── supabase/schema.sql            # DB 스키마/인덱스/RLS/뷰
├── scripts/
│   ├── migrate.py                 # REST API 기반 마이그레이션
│   └── migrate_via_mcp.py         # MCP 기반 마이그레이션 (M1 실사용)
├── server/                        # 정적 호스팅용 더미 (GitHub Pages에서는 미사용)
├── vite.config.ts                 # `VITE_BASE` 환경변수로 Pages 경로 prefix 제어
├── package.json
└── project_plan.md
```

## 디자인 시스템

`Devotional Editorial` 컨셉. 페이퍼 톤 배경(`oklch(0.97 0.012 85)`)에 잉크 블루 액센트(`oklch(0.32 0.05 250)`), 본문은 `Pretendard Variable`, 디스플레이는 `Fraunces italic`. 출석 토글은 마일스톤 3에서 도장(stamp) 메타포로 구현 예정.

## 로컬 개발

```bash
pnpm install
pnpm dev               # http://localhost:3000
```

Supabase URL과 anon 키는 `client/src/lib/supabase.ts`에 fallback으로 포함되어 있어 추가 환경변수 없이 동작합니다. 다른 Supabase 인스턴스를 쓰려면 `.env.local`에 다음을 설정.

```env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

## 빌드

```bash
pnpm build:pages       # GitHub Pages용 정적 빌드 (dist/public)
```

로컬 자체 호스팅용으로는 `pnpm build` (server bundle 포함).

## GitHub Pages 배포

main 브랜치 push 시 `.github/workflows/deploy.yml`이 자동 실행. 사전 작업:

1. Repository → Settings → Pages → Source를 **GitHub Actions**로 설정.
2. Repository → Settings → Secrets and variables → Actions → New repository secret로 다음 두 개 등록:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. main에 push하면 워크플로우가 실행되어 `https://<user>.github.io/<repo>/` 에 배포.

워크플로우는 `VITE_BASE=/${{ repo-name }}/`를 빌드 시 주입하여 정적 자원 경로를 자동 보정하고, SPA fallback을 위해 `index.html`을 `404.html`로 복사합니다.

## Supabase 스키마 적용

```bash
# Supabase Dashboard → SQL Editor에서 실행하거나
psql "$DATABASE_URL" -f supabase/schema.sql
```

스키마 적용 후 1회만 데이터 마이그레이션(아래) 실행.

## 엑셀 → Supabase 마이그레이션

```bash
pip install openpyxl requests

export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_KEY="<service_role_key>"   # anon 아님

python3 scripts/migrate.py --excel-path "2026 고등부 출석부.xlsx" --dry-run
python3 scripts/migrate.py --excel-path "2026 고등부 출석부.xlsx"
```

마일스톤 1에서는 MCP 도구 기반 `scripts/migrate_via_mcp.py`로 교사 17명, 학생 66명, 출석 기록 749건을 적재 완료했습니다.

## 라우팅

| 경로 | 페이지 | 인증 |
| --- | --- | --- |
| `/` | 학생 명단 (마일스톤 3에서 출석 입력으로 확장) | 필요 |
| `/login` | 이메일/패스워드 로그인 | 불필요 |

## 다음 단계 (마일스톤 3)

- 주차 선택 + 학생 카드 출석 토글 UI (도장 애니메이션)
- 출석률 통계 뷰 시각화 (recharts)
- 교사/학생 CRUD 화면
- 회원가입 또는 관리자 초대 기반 교사 계정 발급
