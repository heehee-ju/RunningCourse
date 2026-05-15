import type { DistanceCategory } from '@/commons/utils/distance/category';

export type MarkerVisualState = 'default' | 'hover' | 'clicked';

/** 원본 144×200 PNG를 공식 예제 핀과 비슷한 스케일로 표시 (비율 유지 48×66) */
export const ROUTE_MARKER_ICON_DISPLAY_SIZE = {
  width: 48,
  height: 66,
} as const;

const CATEGORY_TO_ICON_PATH: Record<DistanceCategory, string> = {
  UNDER_3: '/assets/icons/courses-marker/marker_blue.png',
  BETWEEN_3_AND_5: '/assets/icons/courses-marker/marker_green.png',
  BETWEEN_5_AND_10: '/assets/icons/courses-marker/marker_red.png',
  OVER_10: '/assets/icons/courses-marker/marker_orange.png',
};

/** 원본 PNG(144×200) 알파 픽셀 기준 핀 꼭짓점 좌표 */
const ROUTE_MARKER_SOURCE_SIZE = { width: 144, height: 200 } as const;
const ROUTE_MARKER_SOURCE_TIP = { x: 67.5, y: 149 } as const;

/** 표시 크기에 맞춘 핀 꼭짓점 앵커. 소수점 앵커로 꼭짓점을 정확히 맞춘다. */
export function getRouteMarkerAnchorForDisplay(): { x: number; y: number } {
  return {
    x:
      (ROUTE_MARKER_SOURCE_TIP.x / ROUTE_MARKER_SOURCE_SIZE.width) *
      ROUTE_MARKER_ICON_DISPLAY_SIZE.width,
    y:
      (ROUTE_MARKER_SOURCE_TIP.y / ROUTE_MARKER_SOURCE_SIZE.height) *
      ROUTE_MARKER_ICON_DISPLAY_SIZE.height,
  };
}

/**
 * 거리 카테고리별 마커 PNG.
 * `visualState`는 호출부 시그니처 호환용이며, 아이콘 경로는 카테고리만으로 결정된다.
 * 클릭·호버 구분은 `syncRouteMarkerDomVisualState` + CSS(`data-route-marker-visual`)로 처리한다.
 */
export function getRunningCourseMarkerIconUrlForCategory(
  category: DistanceCategory,
  _visualState?: MarkerVisualState,
): string {
  return CATEGORY_TO_ICON_PATH[category];
}
