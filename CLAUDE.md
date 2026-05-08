# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 참고하는 가이드입니다.

## 프로젝트 개요

**RunningCourse**는 위치 기반 러닝 코스 커뮤니티 웹앱입니다.
주요 기능: 지도 기반 코스 탐색 (TMap SDK), 폴리라인으로 코스 생성, 사용자 인증 (Google OAuth + 익명 세션), 좋아요 기능.

## 주요 명령어

```bash
npm run dev              # 개발 서버 (localhost:3000)
npm run build            # 프로덕션 빌드
npm run lint             # ESLint 실행
npm run storybook        # Storybook (localhost:6006)
npm run build-storybook  # Storybook 정적 사이트 빌드
npx vitest               # 테스트 실행 (Playwright 기반)
```

## 아키텍처

**스택:** Next.js 14 App Router · TypeScript · CSS Modules · Supabase (인증 + DB) · TMap Vector SDK

**데이터 흐름:**

```
Page/Component → Server Action (src/actions/) → Service (src/services/) → Repository (src/repositories/) → Supabase
```

- **Server Actions**: 인증, 코스 CRUD, 폼 제출 등 mutation 처리
- **Repositories**: Supabase를 직접 호출하는 유일한 레이어
- **Services**: Actions와 Repositories 사이의 비즈니스 로직
- **Server Components**: 데이터 패칭; Client Components (`'use client'`)는 인터랙션 상태 관리

**주요 디렉토리:**

- `src/app/` — Next.js App Router 페이지 & 레이아웃
- `src/actions/` — 인증, 코스, 유저 관련 Server Actions
- `src/components/` — 기능별 컴포넌트 (`home/`, `courses-detail/`, `mypage/`, `course-submit/`, `tmap/` 등)
- `src/commons/` — 공통 UI 컴포넌트, 훅, 상수, 프로바이더, 타입, 유틸
- `src/repositories/` — 데이터 접근 (course, user, map 레포지토리)
- `src/services/` — 비즈니스 로직 (course, user, map 서비스)
- `src/lib/supabase/` — 서버, 클라이언트, 미들웨어용 Supabase 클라이언트 설정

## 인증

`AuthProvider` (`src/commons/providers/auth/`)가 세 가지 플래그를 제공합니다:

- `isLoggedIn` — 세션 존재 여부 (게스트/익명 포함)
- `isAuthenticated` — 실제 OAuth 로그인 유저 (익명 아님)
- `isAnonymous` — 게스트 세션

미들웨어 (`middleware.ts`)는 모든 요청에서 세션을 갱신하고 비공개 라우트를 보호합니다. 익명 유저는 탐색만 가능하며 코스 생성/수정/좋아요는 불가합니다.

**비공개 라우트:** `/courses/new`, `/courses/[id]/edit`, `/mypage`

## DB 스키마 (Supabase Postgres)

- `users`: `id, nickname, profile_image_url, is_anonymous`
- `routes`: `id, user_id, title, description, distance_meters, path_data (JSON), start_lat, start_lng, start_address_region, image_urls, likes_count, created_at, updated_at`
- `route_likes`: 복합키 `(user_id, route_id)`
- 스토리지 버킷: `course_images` (공개)

## 환경 변수

`.env.local`에 필수 설정:

```
NEXT_PUBLIC_TMAP_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 코딩 컨벤션

- **스타일:** 컴포넌트별 CSS Modules; 인라인 스타일 금지. 색상·타이포그래피 등 상수는 `src/commons/constants/`에 위치.
- **경로 별칭:** `@/*` → `src/*`
- **컴포넌트:** 스토리 (`.stories.tsx`), 스타일 (`.module.css`), 컴포넌트 전용 훅을 같은 디렉토리에 위치.
- **`console.log` 사용 금지** (ESLint 경고); `console.error/warn/info`는 허용.
- **React Strict Mode** 비활성화 (`next.config.mjs`).
- import 순서는 ESLint로 강제: 외부 → 내부 → 상대경로.

## Git 워크플로우

- `main` — 프로덕션 전용, 직접 커밋 금지
- `dev` — 통합 브랜치; 모든 기능은 PR + 1명 이상 승인 후 머지
- 기능 브랜치: `feat/<기능명>`
