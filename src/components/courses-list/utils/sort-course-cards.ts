// 홈 코스 목록 바텀시트용 — 카드 뷰를 정렬 모드에 맞게 재배열한다.
import type { CourseCardView } from '@/commons/types/routerun';
import { pinToTopIfVisible } from '@/components/home/utils/course-filter';

export type CourseListSortMode = 'distance' | 'likes';

/** 거리순은 부모에서 정렬된 `cards` 순서를 유지하고, 좋아요순은 재정렬 후 선택 핀을 복원한다. */
export function sortCourseCardsForDisplay(
  cards: CourseCardView[],
  mode: CourseListSortMode,
  getCourseLikeCount?: (courseId: string) => number,
): CourseCardView[] {
  if (mode === 'distance') {
    return cards;
  }

  const pinnedCourseId = cards.find((card) => card.isPinnedTop)?.courseId ?? null;
  const stripped = cards.map((card) => ({ ...card, isPinnedTop: false }));
  const sorted = [...stripped].sort((left, right) => {
    const likesLeft = getCourseLikeCount?.(left.courseId) ?? left.likeCount;
    const likesRight = getCourseLikeCount?.(right.courseId) ?? right.likeCount;
    if (likesRight !== likesLeft) {
      return likesRight - likesLeft;
    }
    return left.title.localeCompare(right.title, 'ko');
  });

  return pinToTopIfVisible(sorted, pinnedCourseId);
}
