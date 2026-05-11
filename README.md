# 2026 고등부 출석부 웹서비스 프로젝트

본 프로젝트는 기존 Google Sheets 기반의 고등부 출석부를 대체하기 위한 웹서비스 구축 프로젝트입니다. 현재 마일스톤 1단계(데이터베이스 설계 및 데이터 마이그레이션)가 완료되었습니다.

## 디렉터리 구조

```text
/mnt/desktop/MANUS/2026-attendance-webapp/
├── README.md               # 프로젝트 개요 및 실행 방법 안내 (현재 파일)
├── project_plan.md         # 프로젝트 구상 및 분석 결과 문서
├── supabase/
│   └── schema.sql          # Supabase PostgreSQL 스키마 (테이블, 인덱스, RLS, 뷰)
└── scripts/
    ├── migrate.py          # REST API 기반 마이그레이션 스크립트 (service_role 키 필요)
    └── migrate_via_mcp.py  # MCP 도구 기반 마이그레이션 스크립트 (실제 사용됨)
```

## 마일스톤 1단계 완료 내역

1. **Supabase 프로젝트 생성**
   * 프로젝트명: `attendance-2026`
   * 리전: `ap-northeast-2` (서울)
   * URL: `https://ovtgwbhbwtfwzgaihlmb.supabase.co`

2. **데이터베이스 스키마 구축 (`supabase/schema.sql`)**
   * `teachers` (교사 명단), `students` (학생 명단), `attendance` (출석 기록) 테이블 생성.
   * 조회 성능 최적화를 위한 인덱스 생성.
   * 데이터 보안을 위한 Row Level Security (RLS) 정책 적용.
   * 통계 산출을 위한 SQL View (`v_attendance_stats`, `v_student_attendance_summary`) 생성.

3. **기존 엑셀 데이터 마이그레이션 (`scripts/migrate_via_mcp.py`)**
   * `2026 고등부 출석부.xlsx` 파일 파싱.
   * 교사 17명, 학생 66명, 출석 기록 749건(결석 제외)을 Supabase 데이터베이스에 성공적으로 삽입 및 검증 완료.

## 스크립트 실행 방법

### 1. REST API 기반 스크립트 (`migrate.py`)
이 스크립트는 Supabase의 REST API를 사용하여 데이터를 삽입합니다. 실행하려면 `service_role` 권한을 가진 API 키가 필요합니다.

```bash
# 필수 패키지 설치
pip install openpyxl requests

# 환경변수 설정
export SUPABASE_URL="https://ovtgwbhbwtfwzgaihlmb.supabase.co"
export SUPABASE_KEY="당신의_service_role_키"

# Dry-run (실제 삽입 없이 파싱 결과만 확인)
python3 scripts/migrate.py --excel-path "경로/2026 고등부 출석부.xlsx" --dry-run

# 실제 마이그레이션 실행
python3 scripts/migrate.py --excel-path "경로/2026 고등부 출석부.xlsx"
```

### 2. MCP 기반 스크립트 (`migrate_via_mcp.py`)
이 스크립트는 Manus 환경 내에서 `manus-mcp-cli` 도구를 활용하여 SQL 쿼리를 직접 실행합니다. (마일스톤 1단계에서 실제 데이터 삽입에 사용되었습니다.)

```bash
# 필수 패키지 설치
pip install openpyxl

# 실행 (Manus 샌드박스 환경 내에서만 동작)
python3 scripts/migrate_via_mcp.py
```

## 다음 단계 (마일스톤 2단계)
* Vite + React 기반의 프론트엔드 프로젝트 초기화.
* Supabase Client 연동 및 로그인/인증 기능 구현.
