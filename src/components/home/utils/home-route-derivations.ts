// 홈 코스 목록·지도용 파생 라우트 배열 계산 (순수 함수)

import type { Route, RouteViewport } from '@/commons/types/runroute';

import {
  dedupeRoutesById,
  filterRoutesByCategories,
  filterRoutesByRouteViewport,
  type DistanceCategory,
} from './course-filter';

/** 뷰포트 조회 결과 우선, 없을 때만 마커 클릭 시 저장한 스냅샷 사용 */
function resolveSelectedRouteForMerge(
  selectedCourseId: string | null,
  allRoutes: Route[],
  selectedRouteSnapshot: Route | null,
): Route | null {
  if (!selectedCourseId) return null;
  const fromFetch = allRoutes.find((route) => route.id === selectedCourseId);
  if (fromFetch) return fromFetch;
  if (selectedRouteSnapshot?.id === selectedCourseId) return selectedRouteSnapshot;
  return null;
}

/** 선택 코스가 카테고리 필터 밖이어도 목록·지도에 유지하도록 병합 */
export function computeFilteredRoutesForHome(
  routes: Route[],
  selectedCategories: Set<DistanceCategory>,
  selectedCourseId: string | null,
  allRoutes: Route[],
  selectedRouteSnapshot: Route | null,
): Route[] {
  const base = filterRoutesByCategories(routes, selectedCategories);
  if (!selectedCourseId) {
    return base;
  }
  if (base.some((route) => route.id === selectedCourseId)) {
    return base;
  }
  const selected = resolveSelectedRouteForMerge(selectedCourseId, allRoutes, selectedRouteSnapshot);
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
  selectedRouteSnapshot: Route | null,
): Route[] {
  const base = filterRoutesByRouteViewport(filteredRoutes, effectiveQueryViewport);
  if (!selectedCourseId) {
    return base;
  }
  if (base.some((route) => route.id === selectedCourseId)) {
    return base;
  }
  const selected = resolveSelectedRouteForMerge(selectedCourseId, allRoutes, selectedRouteSnapshot);
  if (!selected) {
    return base;
  }
  return dedupeRoutesById([selected, ...base]);
}
