import { redirect } from 'next/navigation';

import CourseSubmit from '@/components/course-submit';
import { createClient } from '@/lib/supabase/server';
import { getUserRouteWriteCount } from '@/services/course/courseService';

/**
 * 코스 신규 등록 페이지 (Server Component)
 *
 * **접근 제어 (URL 직접 접근 포함)**
 * 1. 세션이 없으면 로그인 페이지로 보낸다.
 * 2. 게스트(`user.is_anonymous === true`, Supabase 표준)는 DB 집계 실패 시에도 진입을 막고,
 *    작성 코스가 1건 이상이면 마이페이지로 되돌린다(게스트 1코스 제한).
 *    클라이언트(`auth.provider`의 `user.is_anonymous === true`)와 동일한 기준으로 익명 여부를 판별한다.
 *
 * UI 모달과 별도로, 서버에서 한 번 더 막아 직접 URL 접근·새로고침으로 우회하지 못하게 한다.
 */
export default async function CourseNewPage() {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user) {
    if (userError) {
      console.error('[CourseNewPage] getUser 실패:', userError.message);
    }
    redirect('/login');
  }

  const isGuestUser = user.is_anonymous === true;

  if (isGuestUser) {
    const { count, error } = await getUserRouteWriteCount(user.id);

    const limitExceededOrUnsafe = error !== null || count === null || count >= 1;

    if (limitExceededOrUnsafe) {
      if (error) {
        console.error('[CourseNewPage] 게스트 코스 개수 조회 실패 — 진입 차단:', error);
      } else if (count === null) {
        console.error(
          '[CourseNewPage] 게스트 코스 개수가 null — 집계 불명으로 진입 차단 (userId 일부):',
          user.id.slice(0, 8),
        );
      }
      redirect('/mypage?error=guest_limit_exceeded');
    }
  }

  return <CourseSubmit mode="new" />;
}
