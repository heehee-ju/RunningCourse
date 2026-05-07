// 홈 코스 목록·지도용 파생 라우트 배열 계산 (순수 함수)

import type { Route, RouteViewport } from '@/commons/types/runroute';

import {
  dedupeRoutesById,
  filterRoutesByCategories,
  filterRoutesByRouteViewport,
  type DistanceCategory,
} from './course-filter';

/** 선택 코스가 카테고리 필터 밖이어도 목록·지도에 유지하도록 병합 */
export function computeFilteredRoutesForHome(
  routes: Route[],
  selectedCategories: Set<DistanceCategory>,
  selectedCourseId: string | null,
  allRoutes: Route[],
): Route[] {
  const base = filterRoutesByCategories(routes, selectedCategories);
  if (!selectedCourseId) {
    return base;
  }
  if (base.some((route) => route.id === selectedCourseId)) {
    return base;
  }
  const selected = allRoutes.find((route) => route.id === selectedCourseId);
  if (!selected) {
    return base;
  }
  return dedupeRoutesById([selected, ...base]);
}

/** 바텀시트 가림 영역 반영 목록용 라우트 */
export function computeRoutesForCourseListForHome(
  filteredRoutes: Route[],
  effectiveQueryViewport: RouteViewport | null,
  selectedCourseId: string | null,
  allRoutes: Route[],
): Route[] {
  const base = filterRoutesByRouteViewport(filteredRoutes, effectiveQueryViewport);
  if (!selectedCourseId) {
    return base;
  }
  if (base.some((route) => route.id === selectedCourseId)) {
    return base;
  }
  const selected = allRoutes.find((route) => route.id === selectedCourseId);
  if (!selected) {
    return base;
  }
  return dedupeRoutesById([selected, ...base]);
}
