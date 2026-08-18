# 2026 고등부 출석부 웹서비스

기존 Google Sheets 기반 출석부를 대체하는 React + Vite + Supabase 웹앱.  
GitHub Pages를 통해 정적 호스팅하며, 인증·데이터 관리는 Supabase가 담당합니다.

**리포지토리 URL**: https://github.com/ominexus/attendance-2026-webapp  
**배포 URL**: https://ominexus.github.io/attendance-2026-webapp/

---

## 📌 진행 현황

| 마일스톤 | 범위 | 상태 |
| --- | --- | --- |
| **M1** | Supabase 프로젝트/스키마/RLS, 엑셀→DB 마이그레이션 | 완료 |
| **M2** | React + Vite + Tailwind + Supabase 연동, GitHub Pages 배포 파이프라인 | 완료 |
| **M3** | 출석 입력 UI(도장 토글), 통계 대시보드(Recharts), 학생/교사 관리(CSV·XLSX 일괄 등록) | 완료 |
| **M4-1** | 회원가입 + 관리자 초대 + role 구분 (`profiles` + Edge Function) | 완료 |
| **M4-1.5** | **공개 조회 + 관리자 전용 입력** (RLS public read / admin write) | 완료 |
| **M4-2** | UI 단순화: Guest/Admin 2모드, 회원가입/초대 UI 기본 감춤 | 완료 |
| **M4-3** | **결석 사유 메모** (`absence_notes`, 누구나 작성 가능) | 완료 |
| **M4-4** | **Pass Code 단축 로그인** (`/access`, `VITE_PASS_CODE` 검증 후 자동 signIn) | 완료 |
| **M4-6** | **반별/남여 그룹핑 UI** (Home 출석 입력 화면, 성별 선택 필드 추가) | 완료 |
| **M4-7** | **행동 지표 전환** (출석률 제거 → 출석·결석·메모 카운트, Stats KPI 재구성) | 완료 |
| **M4-8** | **활동학생(`is_active`) 기능** (DB 마이그레이션, Home 필터링+자동 승격, Roster 토글, Stats 보정) | 완료 |
| **M4-9** | **이력 패널 + 비활동 후보 기능** (`StudentHistoryPanel`, 카드/행 클릭 상세 모달, 비활동 후보 일괄 관리) | 완료 |
| **M4-10** | **용어 정정** ('인도자' → '교사' / `students.guide`는 '데려온 친구'로 UI 라벨 명확화) | 완료 |
| **M4-11** | 새로고침 무한 로딩 버그 수정 (AuthContext `onAuthStateChange` 단일 경로 정리) | 완료 |
| **M4-12** | **학생 인라인 편집 강화** (이름/학년/반/성별/데려온 친구/활동여부 + **학교/전화번호** 추가) | 완료 |
| **M4-13~16** | 전역 날짜 컨텍스트 (`SelectedDateContext`) + URL `?date=` 동기화 + DateSpinner 자동 보정 | 완료 |
| **M4-17** | `attendance_dates` 테이블 + DateSpinner 소스 전환 + **주간 관리 페이지 (`/weeks`)** | 완료 |
| **M4-22** | **새친구 관리** (`guests` + `guest_attendance`, 새친구 추가/출석, 정규 학생 승격 및 이력 소급) | 완료 |
| **M4-22r** | **새친구 UI 개편**: 초청주 토글 제거, 모든 주 새친구 섹션 항상 표시 및 통계 연동 | 완료 |
| **M4-23** | **Supabase 대용량 쿼리 제한 해결**: PostgREST 1000건 제한 대응 페이지네이션/청크 처리 | 완료 |
| **M4-24** | **Supabase Keep-Alive 자동화**: 무료 티어 7일 비활성 자동 Pause 방지 GitHub Actions 워크플로우 | 완료 |

---

## 🗂️ 디렉터리 구조

```text
attendance-2026-webapp/
├── .github/
│   └── workflows/
│       ├── deploy.yml                 # GitHub Pages 빌드 및 자동 배포 파이프라인
│       └── supabase-keep-alive.yml    # Supabase 7일 미사용 자동 Pause 방지 (3일 주기 Keep-Alive)
├── client/                            # React + Vite 프론트엔드
│   ├── index.html
│   └── src/
│       ├── App.tsx                    # 라우팅 + Provider 조립
│       ├── components/
│       │   ├── AppLayout.tsx          # 사이드바 + 모바일 상단 네비게이션
│       │   ├── DateSpinner.tsx        # 주차 선택 스피너
│       │   ├── NewFriendSection.tsx   # 새친구 추가 및 출석 섹션
│       │   ├── StudentHistoryPanel.tsx# 학생 출석 이력 및 상세 수정 패널
│       │   └── ui/                    # shadcn/ui 컴포넌트 라이브러리
│       ├── contexts/
│       │   ├── AuthContext.tsx        # Supabase 인증 및 권한 상태 관리
│       │   └── SelectedDateContext.tsx# 전역 날짜 상태 동기화
│       ├── lib/
│       │   ├── supabase.ts            # Supabase 클라이언트 및 도메인 타입 정의
│       │   └── homeAttendanceLoader.ts# 홈 화면 데이터 로더 및 최적화
│       ├── pages/
│       │   ├── Home.tsx               # 출석 입력 (도장 토글, 결석 메모, 새친구, Optimistic UI)
│       │   ├── Stats.tsx              # 통계 대시보드 (Recharts, 지표 차트, 메모 내역)
│       │   ├── Roster.tsx             # 학생/교사/새친구 관리 (CRUD, 승격, CSV 일괄 업로드)
│       │   ├── Weeks.tsx              # 주차별 출석일(`attendance_dates`) 관리 대시보드
│       │   ├── PassCode.tsx           # Pass Code 단축 관리자 로그인 (/access)
│       │   ├── Login.tsx              # 관리자 직접 이메일/비밀번호 로그인
│       │   └── Signup.tsx             # 회원가입
├── supabase/
│   ├── schema.sql                     # PostgreSQL 기본 스키마 / 인덱스 / RLS
│   ├── migrations/                    # 기능별 마이그레이션 SQL 스크립트
│   └── functions/
│       └── invite-user/index.ts       # 관리자 전용 초대 Edge Function
├── scripts/
│   ├── migrate.py                     # REST API 기반 마이그레이션
│   └── migrate_via_mcp.py             # 초기 데이터 적재 스크립트
├── vite.config.ts                     # Vite 설정 (GitHub Pages base path 연동)
├── package.json
└── project_plan.md
```

---

## 💻 로컬 개발 환경 설정

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 환경변수 설정

기본값이 `client/src/lib/supabase.ts`에 내장되어 있어 별도 설정 없이도 실행 가능하지만, 개인 Supabase 프로젝트에 연결하려면 루트에 `.env.local` 파일을 생성하세요.

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>

# Pass Code 단축 로그인 (로컬 개발용)
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

# 전체 빌드
pnpm build
```

---

## 🚦 라우팅 및 페이지 권한

| 경로 | 페이지 | 비로그인 (Guest) | 관리자 (Admin) | 설명 |
| :--- | :--- | :---: | :---: | :--- |
| `/` | **출석 입력** | 조회 + 결석메모 작성 | 도장 토글 + 새친구 추가/출석 + 정보 수정 | 출석 체크, 새친구 관리, 결석 사유 메모 |
| `/stats` | **통계 대시보드** | 조회 전용 | 조회 전용 | 주차별·반별·성별 통계, 행동 지표, 새친구 KPI |
| `/roster` | **명단 관리** | 조회 전용 | CRUD + 승격 + CSV 일괄등록 | 학생/교사 명단, 새친구 승격, 비활동 후보 모달 |
| `/weeks` | **주간 관리** | 조회 전용 | 추가/수정/삭제 | 주차별 출석일(`attendance_dates`) 관리 |
| `/access` | **Pass Code** | 누구나 접근 | - | 4~6자리 Pass Code 입력 시 관리자 자동 로그인 |
| `/login` | **로그인** | 누구나 접근 | - | 관리자 이메일/비밀번호 직접 로그인 |

---

## 🔑 주요 핵심 기능 상세

### 1. 출석 입력 (`/`)
- **도장 메타포 토글**: 학생 카드를 클릭하면 도장 애니메이션과 함께 즉각적인 출석/결석 변경(Optimistic UI) 처리.
- **결석 사유 메모 (`absence_notes`)**: 결석 학생 카드 하단에 사유 입력란 제공. 비로그인 방문자도 기록 가능.
- **새친구 섹션 (`NewFriendSection`)**: 모든 주차에 상시 표시되며, 새친구 추가 모달 및 실시간 출석 체크 지원.
- **상세 이력 패널 (`StudentHistoryPanel`)**: 학생 카드/이름 클릭 시 최근 12주 출석 이력, 기본 인적사항(학교, 전화번호, 데려온 친구) 조회 및 관리자 인라인 수정 가능.

### 2. 통계 대시보드 (`/stats`)
- **행동 지표 전환**: 출석률 단순 계산을 넘어 실제 출석/결석/메모 작성 건수를 종합 집계.
- **1000건 쿼리 제한(Pagination) 대응**: PostgREST 기본 1000건 제한을 극복하고 전체 주차 데이터를 정확하게 집계.
- **성별 / 반별 / 새친구 KPI**: 남여 비율, 반별 출석 현황, 해당 주차 새친구 출석 인원 표시.

### 3. 명단 및 새친구 관리 (`/roster`)
- **학생 탭**: 학년/반/성별/학교/연락처/데려온 친구/활동여부 관리, CSV/엑셀 일괄 등록 및 템플릿 다운로드 제공.
- **교사 탭**: 교사 명단 및 직분/담당반 관리.
- **새친구 탭**: 방문한 새친구 목록 및 누적 출석 횟수 확인, **[정규 학생으로 승격]** 기능 (승격 시 `students` 테이블 추가 및 과거 출석 이력 소급 이전).
- **비활동 후보 모달**: 장기 결석(예: 4주 이상) 학생을 비활동 후보로 일괄 추출하고 활동 여부(`is_active`)를 손쉽게 조정.

### 4. 주간 관리 (`/weeks`)
- 매주 출석 기준일(`attendance_dates`)을 등록하고 관리.
- 날짜 스피너(`DateSpinner`)와 실시간 연동되어 최신 일요일을 기본값으로 자동 보정.

---

## 🔒 보안 및 RLS (Row Level Security) 정책

| 테이블 | SELECT | INSERT / UPDATE | DELETE |
| :--- | :--- | :--- | :--- |
| `attendance`, `students`, `teachers` | 누구나 (`anon`, `authenticated`) | 관리자만 (`is_admin()`) | 관리자만 (`is_admin()`) |
| `guests`, `guest_attendance` | 누구나 (`anon`, `authenticated`) | 관리자만 (`is_admin()`) | 관리자만 (`is_admin()`) |
| `attendance_dates` | 누구나 (`anon`, `authenticated`) | 관리자만 (`is_admin()`) | 관리자만 (`is_admin()`) |
| **`absence_notes`** | **누구나 (`anon`, `authenticated`)** | **누구나 (`anon`, `authenticated`)** | **관리자만 (`is_admin()`)** |
| `profiles` | 본인 + 관리자 | 본인 수정 (role 제외) + 관리자 | 관리자만 (`is_admin()`) |

---

## ⚙️ CI/CD 및 자동화 워크플로우

### 1. GitHub Pages 자동 배포 (`.github/workflows/deploy.yml`)
* `main` 브랜치에 코드가 push되면 자동으로 pnpm 빌드를 수행하고 GitHub Pages로 무중단 배포합니다.
* Repository Secrets에 등록된 환경변수를 빌드 시 주입합니다:
  * `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `PASS_CODE`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`

### 2. Supabase 7일 Pause 방지 Keep-Alive (`.github/workflows/supabase-keep-alive.yml`)
* **목적**: Supabase 무료 티어(Free Plan)의 7일 연속 비활성 시 자동 일시 중지(Pause) 정책 방지.
* **주기**: **3일마다 1회** (한국 시간 오전 9:00 / UTC 00:00) GitHub Actions 스케줄러 실행.
* **동작**: `teachers` 테이블의 데이터 1건을 직접 `SELECT` 조회하여 PostgreSQL 데이터베이스 엔진 활동 타이머를 지속적으로 리셋합니다.

---

## 🛠️ 트러블슈팅 및 성능 최적화 이력

### 1. Supabase PostgREST 1000행 쿼리 제한 해결
* **문제**: 데이터가 많아질 때 Supabase PostgREST의 기본 1000행 제한으로 인해 Stats 및 Weeks 페이지에서 과거 출석 기록이 잘리는 현상 발생.
* **해결**: 청크 단위 페이지네이션(Range 쿼리) 로더를 적용하여 1000건 이상의 전체 출석 및 메모 데이터를 손실 없이 집계하도록 개선.

### 2. 인증/세션 동기화 및 모바일 Resume 안정화
* **문제**: 모바일 브라우저 백그라운드 복귀 및 새로고침 시 세션 갱신 과정에서 데드락이 발생하여 무한 로딩 스피너가 걸리던 문제.
* **해결**: `AuthContext`의 `onAuthStateChange` 단일 경로를 정돈하고 `autoRefreshToken` 및 비동기 상태 초기화 타이밍을 최적화.

### 3. 용어 통일 및 데이터 모델 일관성
* UI 상에서 혼란을 주던 '지도교사'/'인도자' 표현을 교사는 **교사**, 학생의 전도자는 **데려온 친구**(`students.guide`)로 직관화.
