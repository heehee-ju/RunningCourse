src/
├── app/ # Next.js App Router
│ ├── layout.tsx
│ ├── page.tsx
│ ├── globals.css
│ ├── home/page.tsx
│ ├── login/page.tsx
│ ├── mypage/page.tsx
│ ├── courses/
│ │ ├── new/page.tsx
│ │ └── [id]/
│ │ ├── page.tsx
│ │ └── edit/page.tsx
│ └── auth/callback/route.ts
│
├── actions/ # 서버 액션
│ ├── auth.action.ts
│ ├── course.action.ts
│ └── user.action.ts
│
├── components/ # 페이지·기능 단위 UI
│ ├── course-submit/ # (+ hooks/, prompts/)
│ ├── courses-detail/
│ ├── courses-list/
│ ├── home/ # (+ hooks/, utils/, prompts/)
│ ├── login/ # (+ hooks/, prompts/)
│ ├── mypage/ # (+ hooks/, 모달·카드 등)
│ └── tmap/
│ ├── home/
│ ├── course-submit/ # (+ hooks/)
│ └── utils/
│
├── commons/ # 공통 UI·레이아웃·상수
│ ├── components/ # button, card, icons, input, modal, spinner, tab, toast, tooltip …
│ ├── constants/ # color, typography, url (+ prompts)
│ ├── hooks/
│ ├── layout/ # header, navigation-bar (+ navigation-item)
│ ├── providers/ # auth, modal, AuthProvider (+ prompts)
│ ├── types/
│ └── utils/
│
├── hooks/
│ └── useCourseLikes.ts
│
├── lib/
│ └── supabase/ # client, server, middleware, initialize, auth/prompts
│
├── repositories/ # 데이터 접근
│ ├── user.repository.ts
│ ├── map.repository.ts
│ └── course/
│ ├── course.repository.ts
│ ├── home.repository.ts
│ └── detail.repository.ts
│
└── services/ # 비즈니스 로직
├── user/ # authService, userService, userValidation
├── course/ # courseService, homeCourseService, courseDetailService, courseLikeService …
└── map/
└── mapService.ts
