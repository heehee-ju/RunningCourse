# Action 레이어

Next.js **Server Actions** (`'use server'`)로, 클라이언트 컴포넌트의 mutation 요청을 처리한다. 인증 확인 → 입력 검증 → Service/Repository 호출 → 캐시 무효화 순서로 실행한다.

## 규칙

- 파일 최상단에 `'use server'`를 선언한다.
- **세션 확인을 먼저 한다.** 인증이 필요한 액션은 `supabase.auth.getUser()`로 유저를 확인하고, 없으면 즉시 에러를 반환한다.
- 입력값의 기본 검증(빈 문자열, UUID 형식, 타입 체크 등)은 Action에서 처리한다. 도메인 규칙 검증은 Service에 위임한다.
- 성공 시 영향받는 경로에 `revalidatePath()`를 호출해 Next.js 캐시를 무효화한다.
- 페이지 이동이 필요하면 `redirect()`를 사용한다. `redirect()`는 내부적으로 throw를 사용하므로 try/catch 안에서 호출하지 않는다.
- 반환 타입은 `{ success: true, data? }` 또는 `{ success: false, error/message }` 형태로 통일한다. 성공 후 redirect하는 경우 반환값 없이 `void`로 끝난다.

## 파일 구조

```
actions/
├── auth.action.ts    # 인증 (Google OAuth, 익명 로그인, 로그아웃, 게스트 계정 삭제)
├── course.action.ts  # 코스 CRUD (등록, 수정, 삭제)
└── user.action.ts    # 유저 (닉네임 중복 확인, 닉네임 변경)
```

## 각 액션 요약

**auth.action.ts**
- `signInWithGoogle(returnTo)` — OAuth URL 발급 후 Google로 redirect
- `linkGoogleAccount(returnTo)` — 익명 세션을 Google 계정과 연동
- `signInAnonymously(returnTo)` — 익명 세션 생성 후 returnTo로 redirect
- `signOut()` — 세션 종료 + Supabase 쿠키 정리 후 `/login`으로 redirect
- `deleteGuestAccount()` — Service Role Admin API로 익명 계정 완전 삭제

**course.action.ts**
- `createCourseAction(input)` — 코스 등록, 역지오코딩 포함. 성공 시 `/`로 redirect
- `deleteCourseAction(routeId)` — 본인 코스 삭제. `/mypage`, `/` 캐시 무효화
- `updateCourseAction(input)` — 제목·설명·이미지 수정. 상세·목록 캐시 무효화

**user.action.ts**
- `checkNicknameAction(nickname)` — 닉네임 형식 검사 + 중복 확인
- `updateNicknameAction(newNickname)` — 닉네임 변경 후 `/mypage` 캐시 무효화

## 주의사항

- `deleteGuestAccount`는 `SUPABASE_SERVICE_ROLE_KEY`를 사용하며 **서버에서만** 실행된다. 이 키는 절대 클라이언트 번들에 포함되면 안 된다.
- `auth.action.ts`의 `resolveSiteOrigin()`은 `NEXT_PUBLIC_SITE_URL` → `VERCEL_URL` → `localhost` 순으로 폴백한다. 새 환경 추가 시 이 함수를 확인한다.
- redirect URL 검증: `isRelativePath()`로 `/`로 시작하는 상대 경로만 허용해 open redirect를 방지한다.
