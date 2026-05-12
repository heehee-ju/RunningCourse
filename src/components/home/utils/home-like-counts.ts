// 홈 코스 카드 좋아요 수 조회용 id→likes_count 맵 (선택 코스가 fetch 결과 밖일 때 스냅샷으로 보정)

import type { Route } from '@/commons/types/runroute';

/** 전체 라우트에서 맵을 만들고, 뷰포트 밖 선택 코스는 스냅샷 likes로 채운다 */
export function buildCourseLikeCountsLookup(
  allRoutes: Route[],
  selectedCourseId: string | null,
  selectedRouteSnapshot: Route | null,
): Record<string, number> {
  const acc = allRoutes.reduce<Record<string, number>>((map, route) => {
    map[route.id] = route.likes_count;
    return map;
  }, {});
  if (
    selectedCourseId &&
    selectedRouteSnapshot?.id === selectedCourseId &&
    acc[selectedCourseId] === undefined
  ) {
    acc[selectedCourseId] = selectedRouteSnapshot.likes_count;
  }
  return acc;
}
