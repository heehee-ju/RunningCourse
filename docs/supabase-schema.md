# Supabase 스키마 (RunningCourse)

이 문서는 **애플리케이션 코드**(`src/repositories`, `src/services`, `auth/callback` 등)에서 사용하는 테이블·컬럼을 기준으로 정리했습니다.  
실제 Postgres의 타입·기본값·인덱스·RLS·트리거는 대시보드 또는 아래 [스키마 갱신 방법](#스키마-갱신-방법)으로 확인하는 것이 좋습니다.

---

## 스키마: `public`

### `users`

| 컬럼                | 앱에서의 용도                | 비고      |
| ------------------- | ---------------------------- | --------- |
| `id`                | `auth.users`와 동일한 UUID   | PK로 가정 |
| `nickname`          | 표시명, 중복 검사            | nullable  |
| `profile_image_url` | 프로필 이미지 URL            | nullable  |
| `is_anonymous`      | OAuth 연동 후 `false`로 갱신 | boolean   |

**참고 코드:** `src/repositories/user.repository.ts`, `src/app/auth/callback/route.ts`

---

### `routes`

| 컬럼                     | 앱에서의 용도     | 비고                              |
| ------------------------ | ----------------- | --------------------------------- |
| `id`                     | 코스 식별자       | UUID                              |
| `user_id`                | 작성자            | `users.id`와 연동 가정            |
| `title`                  | 제목              |                                   |
| `description`            | 설명              | nullable                          |
| `distance_meters`        | 거리(미터)        |                                   |
| `path_data`              | Tmap 등 경로 JSON | `json`/`jsonb` 가능               |
| `start_lat`, `start_lng` | 시작 좌표         |                                   |
| `start_address_region`   | 지역 문자열       | nullable, 생성 시 선택            |
| `image_urls`             | 이미지 URL 배열   | 배열 타입                         |
| `likes_count`            | 좋아요 수         | `route_likes` 집계 후 앱에서 갱신 |
| `created_at`             | 생성 시각         |                                   |
| `updated_at`             | 수정 시각         | 수정 시 갱신                      |

**참고 코드:** `src/repositories/course/course.repository.ts`, `detail.repository.ts`, `home.repository.ts`, `scripts/migrate-route-path-data.mjs`

---

### `route_likes`

| 컬럼       | 앱에서의 용도 | 비고        |
| ---------- | ------------- | ----------- |
| `user_id`  | 찜한 사용자   |             |
| `route_id` | 대상 코스     | `routes.id` |

**제약(코드에서 유추):** `upsert(..., { onConflict: 'user_id,route_id' })` → `(user_id, route_id)` 유니크.

**참고 코드:** `src/repositories/course/course.repository.ts`, `src/services/course/courseLikeService.ts`

---

## Storage

| 버킷            | 용도                            |
| --------------- | ------------------------------- |
| `course_images` | 코스 이미지 업로드 (public URL) |

**참고 코드:** `src/commons/utils/storage.util.ts` (`COURSE_IMAGES_BUCKET`)

---

## Auth

Supabase Auth(`signInWithOAuth`, `signInAnonymously`, `linkIdentity` 등)를 사용합니다.  
`public.users` 행은 보통 Auth 사용자 생성 시 트리거/앱 로직으로 동기화하는 패턴이 많습니다(이 저장소 SQL에는 정의 없음).

---

## 스키마 갱신 방법

### 1) SQL 에디터 (가장 정확)

Supabase 대시보드 → **SQL Editor**에서 예:

```sql
select
  c.table_schema,
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
order by c.table_name, c.ordinal_position;
```

FK·PK만 보고 싶다면 `information_schema.table_constraints`, `key_column_usage` 등을 조회하면 됩니다.

### 2) Cursor Supabase MCP

Personal Access Token을 MCP 환경 변수 `SUPABASE_ACCESS_TOKEN`에 넣은 뒤, `list_tables` 도구에 `verbose: true`로 요청하면 컬럼·PK·FK 요약을 받을 수 있습니다. (플러그인 MCP는 `project_id`가 필요할 수 있음.)

### 3) Supabase CLI (로컬/링크 프로젝트)

```bash
supabase db dump --schema public
```

CLI 설치 및 프로젝트 링크는 [Supabase CLI 문서](https://supabase.com/docs/guides/cli)를 따릅니다.

---

## 변경 이력

| 날짜       | 내용                      |
| ---------- | ------------------------- |
| 2026-05-04 | 코드베이스 기준 초안 작성 |
