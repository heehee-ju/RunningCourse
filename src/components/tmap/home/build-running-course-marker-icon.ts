/**
 * 티맵 공식 Marker 옵션 패턴 유지: `icon` 은 프로젝트 `public/icons/*.png` 루트 경로 문자열.
 *
 * 홈 지도 마커 색 ↔ 거리 구간 (`getDistanceCategory` 와 동일):
 * - marker_blue   · ~3km   · UNDER_3
 * - marker_green  · 3~5km  · BETWEEN_3_AND_5
 * - marker_red    · 5~10km · BETWEEN_5_AND_10
 * - marker_orange · 10km~  · OVER_10
 */
import type { DistanceCategory } from '@/components/home/utils/course-filter';

export type MarkerVisualState = 'default' | 'hover' | 'clicked';

const CATEGORY_TO_ICON_PATH: Record<DistanceCategory, string> = {
  UNDER_3: '/icons/marker_blue.png',
  BETWEEN_3_AND_5: '/icons/marker_green.png',
  BETWEEN_5_AND_10: '/icons/marker_red.png',
  OVER_10: '/icons/marker_orange.png',
};

/** 원본 144×200 PNG를 공식 예제 핀과 비슷한 스케일로 표시 (비율 유지 48×66) */
export const ROUTE_MARKER_ICON_DISPLAY_SIZE = {
  width: 48,
  height: 66,
} as const;

/** 원본 PNG(144×200) 알파 픽셀 기준 핀 꼭짓점 좌표 */
const ROUTE_MARKER_SOURCE_SIZE = { width: 144, height: 200 } as const;
const ROUTE_MARKER_SOURCE_TIP = { x: 67.5, y: 149 } as const;

/**
 * 표시 크기에 맞춘 핀 꼭짓점 앵커.
 * 꼭짓점을 정확히 맞추기 위해 소수점 앵커를 그대로 사용한다.
 */
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
 * `visualState` 는 기존 호출부 호환용(아이콘은 동일 파일).
 */
export function getRunningCourseMarkerIconUrlForCategory(
  category: DistanceCategory,
  _visualState?: MarkerVisualState,
): string {
  return CATEGORY_TO_ICON_PATH[category];
}
