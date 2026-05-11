# Service 레이어

Repository에서 가져온 데이터를 **조합·가공·검증**하는 비즈니스 로직 계층이다. UI와 DB 사이의 중간 계층.

## 규칙

- Repository를 통해서만 데이터를 읽고 쓴다. Service에 Supabase 쿼리를 직접 두지 않는다.
  - 예외: `courseLikeService.ts`는 홈/목록 화면의 클라이언트 측 좋아요 상태 조회를 위해 `createClient()`를 직접 사용한다. 좋아요 변경(mutation)은 `toggleCourseLikeAction`(course.action.ts)에서 처리한다.
- 여러 Repository 결과를 조합하거나(`Promise.all`), 도메인 규칙을 적용하거나, View Model로 변환하는 역할을 담당한다.
- 입력 유효성 검사(닉네임 형식 등)는 Service 또는 별도 validation 파일에서 처리한다. Repository에 두지 않는다.
- Action에서 `revalidatePath`, `redirect` 같은 Next.js 전용 API를 사용하므로, Service는 순수 비즈니스 로직만 담는다.
- 에러는 `console.error`로 로깅 후 `{ data, error }` 또는 `throw`로 상위에 전달한다.

## 파일 구조

```
services/
├── course/
│   ├── courseService.ts        # 코스 CRUD 비즈니스 로직 (등록·수정·삭제·마이페이지 목록)
│   ├── courseDetailService.ts  # 상세 페이지용 데이터 조합 (코스 + 작성자 + 위치)
│   ├── courseLikeService.ts    # 좋아요 상태 조회 전용 (클라이언트 전용, createClient 사용)
│   └── homeCourseService.ts    # 홈 지도용 코스 목록 (Repository 얇은 래퍼)
├── map/
│   └── mapService.ts           # 역지오코딩 등 지도 관련 로직 (Repository 얇은 래퍼)
└── user/
    ├── authService.ts          # 인증 비즈니스 로직 (현재 미구현)
    ├── userService.ts          # 유저 프로필·닉네임 비즈니스 로직
    └── userValidation.ts       # 닉네임 유효성 검사 (순수 함수, 외부 의존 없음)
```

## 주요 패턴

**데이터 조합:** `courseDetailService.fetchCourseDetail`은 코스·작성자 프로필·역지오코딩을 `Promise.all`로 병렬 패칭한다.

**View Model 변환:** `courseService.routeToMypageCard`처럼 DB 모델(`Route`)을 UI 카드 타입(`MypageRouteCardData`)으로 변환하는 헬퍼를 Service 내에 둔다.

**검증 분리:** `userValidation.ts`는 외부 의존이 없는 순수 함수만 담는다. `userService.ts`에서 import해 사용한다.

**SupabaseClient 주입:** Server Component/Action에서 생성한 Supabase 클라이언트를 매개변수로 받아 처리하는 함수(`fetchMypageRouteLists` 등)와, 내부에서 직접 생성하는 함수가 혼용된다. 신규 함수는 클라이언트를 주입받는 방식을 선호한다.
