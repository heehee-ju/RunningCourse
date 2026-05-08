# Repository 레이어

Supabase(DB)와 TMap 외부 API에 대한 **유일한 통신 창구**다. 비즈니스 로직·UI 상태를 포함하지 않는다.

## 규칙

- **여기서만 Supabase/외부 API를 직접 호출한다.** Service·Action에 Supabase 쿼리를 두지 않는다.
- `SupabaseClient`를 매개변수로 받는 함수는 호출부(Service/Action)에서 클라이언트를 주입한다.
  - 예외: 독립적으로 실행되어야 하는 함수(예: `getRouteCountByUserId`, `deleteRoute`)는 내부에서 `createClient()`를 직접 호출한다.
- 홈 지도(`home.repository.ts`)는 클라이언트 컴포넌트에서 실시간 뷰포트 쿼리를 수행하므로 `createClient` from `@/lib/supabase/client`를 사용한다. 나머지는 서버 전용 `@/lib/supabase/server`를 사용한다.
- 반환 타입은 `{ data, error }` 객체이거나 실패 시 `throw`다. 두 패턴을 혼용하지 말고, 파일 내에서 일관되게 유지한다.
- DB Row → 도메인 타입 변환은 레포지토리 내 `toRoute()` 같은 private 헬퍼가 담당한다.
- 필드 목록은 `const ROUTE_SELECT = '...'` 상수로 관리한다. 쿼리마다 inline으로 작성하지 않는다.

## 파일 구조

```
repositories/
├── course/
│   ├── course.repository.ts   # routes CRUD (create, update, delete, getByUser, getLiked, getCount)
│   ├── detail.repository.ts   # 코스 단건 조회 (getRouteById) — 상세 페이지 전용
│   └── home.repository.ts     # 홈 지도용 목록·뷰포트 조회 (클라이언트 Supabase 사용)
├── map.repository.ts          # TMap API 호출 (역지오코딩, 보행자 경로)
└── user.repository.ts         # users 테이블 CRUD (프로필 조회, 닉네임 중복·수정)
```

## 주의사항

- `course.repository.ts`의 `createRoute`와 `createCourse`는 동일 함수의 별칭이다 (`export const createCourse = createRoute`). 새로운 호출부는 `createCourse`를 사용한다.
- `map.repository.ts`는 Supabase가 아닌 TMap REST API를 fetch로 직접 호출한다. `NEXT_PUBLIC_TMAP_API_KEY` 환경 변수가 없으면 `null`/`throw`로 처리한다.
- `route_likes` 관련 Supabase 쿼리 일부가 현재 `courseLikeService.ts`에 있다 (역사적 이유). 신규 좋아요 로직은 이 레포지토리에 추가한다.
