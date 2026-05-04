/**
 * 출발·경유·도착 마커 — 티맵 예제와 동일한 생성 방식, 아이콘만 `public/icons/*.png`.
 */

export type WaypointMarkerRole = 'start' | 'via' | 'end';

function markerTitleByRole(role: WaypointMarkerRole): string {
  if (role === 'start') return '출발지';
  if (role === 'end') return '도착지';
  return '경유지';
}

/** `public/icons` 에셋 경로 */
const ROLE_TO_ICON_PATH: Record<WaypointMarkerRole, string> = {
  start: '/icons/flag_start.png',
  via: '/icons/flag_point.png',
  end: '/icons/flag_finish.png',
};

export function getWaypointMarkerIconUrl(role: WaypointMarkerRole): string {
  return ROLE_TO_ICON_PATH[role];
}

export function getWaypointMarkerTitle(role: WaypointMarkerRole): string {
  return markerTitleByRole(role);
}
