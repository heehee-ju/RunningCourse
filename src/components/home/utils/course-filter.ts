import type {
  CourseCardView,
  ReferenceLocation,
  Route,
  RouteViewport,
} from '@/commons/types/routerun';
import { type DistanceCategory, getDistanceCategory } from '@/commons/utils/distance/category';
import {
  calculateLinearDistanceMeters,
  hasValidRouteStartCoordinate,
  SEOUL_CITY_HALL_REFERENCE as DEFAULT_REFERENCE,
} from '@/commons/utils/geo';
import { dedupeRoutesById } from '@/commons/utils/route/dedup';

export type { DistanceCategory };
export { getDistanceCategory, dedupeRoutesById };
export const SEOUL_CITY_HALL_REFERENCE = DEFAULT_REFERENCE;

/** 시작점이 주어진 RouteViewport 안에 있는지 (useRoutes 클라이언트 필터와 동일 규칙). */
export function isRouteStartInRouteViewport(route: Route, viewport: RouteViewport | null): boolean {
  if (!viewport) return true;

  const { northEastLat, northEastLng, southWestLat, southWestLng } = viewport;
  const values = [northEastLat, northEastLng, southWestLat, southWestLng];
  if (values.some((value) => !Number.isFinite(value))) {
    return true;
  }

  const minLat = Math.min(northEastLat, southWestLat);
  const maxLat = Math.max(northEastLat, southWestLat);
  const minLng = Math.min(northEastLng, southWestLng);
  const maxLng = Math.max(northEastLng, southWestLng);

  return (
    route.start_lat >= minLat &&
    route.start_lat <= maxLat &&
    route.start_lng >= minLng &&
    route.start_lng <= maxLng
  );
}

/** 목록 등 UI 표시용 — 바텀시트 상단 등에 실제 보이는 영역만 노출할 때 사용 */
export function filterRoutesByRouteViewport(
  routes: Route[],
  viewport: RouteViewport | null,
): Route[] {
  if (!viewport) return routes;
  return routes.filter((route) => isRouteStartInRouteViewport(route, viewport));
}

// [필터] 선택된 거리 카테고리 기준 필터링
export function filterRoutesByCategories(
  routes: Route[],
  selectedCategories: Set<DistanceCategory>,
): Route[] {
  const dedupedRoutes = dedupeRoutesById(routes);

  if (selectedCategories.size === 0) {
    return dedupedRoutes;
  }

  return dedupedRoutes.filter((route) => {
    if (!Number.isFinite(route.distance_meters) || route.distance_meters < 0) {
      return false;
    }

    return selectedCategories.has(getDistanceCategory(route.distance_meters));
  });
}

function toDistanceText(distanceMeters: number): string {
  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

function toCoordinateLocationText(route: Route): string {
  return `시작 좌표 ${route.start_lat.toFixed(4)}, ${route.start_lng.toFixed(4)}`;
}

// [정렬] 선택된 코스를 카드 목록 최상단으로 이동
export function pinToTopIfVisible(
  cards: CourseCardView[],
  selectedCourseId: string | null,
): CourseCardView[] {
  if (!selectedCourseId) {
    return cards.map((card) => ({ ...card, isPinnedTop: false }));
  }

  const index = cards.findIndex((card) => card.courseId === selectedCourseId);
  if (index < 0) {
    return cards.map((card) => ({ ...card, isPinnedTop: false }));
  }

  const pinned = { ...cards[index], isPinnedTop: true };
  const rest = cards
    .filter((_, cardIndex) => cardIndex !== index)
    .map((card) => ({ ...card, isPinnedTop: false }));

  return [pinned, ...rest];
}

// [변환] 코스 데이터를 카드 뷰 모델로 변환
export function buildCourseCardViews(
  routes: Route[],
  referenceLocation: ReferenceLocation,
  selectedCourseId: string | null,
): CourseCardView[] {
  const baseCards = dedupeRoutesById(routes)
    .filter(hasValidRouteStartCoordinate)
    .map((route) => {
      const distanceFromReference = calculateLinearDistanceMeters(referenceLocation, {
        lat: route.start_lat,
        lng: route.start_lng,
      });

      return {
        courseId: route.id,
        title: route.title,
        location: route.start_address_region ?? toCoordinateLocationText(route),
        distanceKm: route.distance_meters / 1000,
        distanceFromReference,
        distanceText: toDistanceText(route.distance_meters),
        likeCount: route.likes_count,
        isPinnedTop: false,
        thumbnailUrl: route.image_urls[0],
      };
    })
    .sort((left, right) => {
      if (left.distanceFromReference !== right.distanceFromReference) {
        return left.distanceFromReference - right.distanceFromReference;
      }

      return left.title.localeCompare(right.title, 'ko');
    });

  return pinToTopIfVisible(baseCards, selectedCourseId);
}
