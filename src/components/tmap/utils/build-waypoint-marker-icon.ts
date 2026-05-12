/**
 * 출발·경유·도착 마커 — 티맵 예제와 동일한 생성 방식, 아이콘만 `public/icons/*.png`.
 */

export type WaypointMarkerRole = 'start' | 'via' | 'end';

function markerTitleByRole(role: WaypointMarkerRole): string {
  if (role === 'start') return '출발지';
  if (role === 'end') return '도착지';
  return '경유지';
}

/** 경유지 순번별 깃발 (`flag_point=1` … `flag_point=5`); 6번째 이상은 5번 아이콘으로 표시 */
export const WAYPOINT_VIA_ICON_MAX_ORDER = 5;

const START_END_ICON: Record<Exclude<WaypointMarkerRole, 'via'>, string> = {
  start: '/icons/flag_start.png',
  end: '/icons/flag_finish.png',
};

/**
 * @param viaOrder 경유지일 때만 사용. 출발지 인덱스 0 기준으로 첫 경유지는 `1`(=`points` 배열 인덱스).
 */
export function getWaypointMarkerIconUrl(role: WaypointMarkerRole, viaOrder?: number): string {
  if (role === 'via') {
    const raw = viaOrder ?? 1;
    const n = Math.min(Math.max(Math.trunc(raw), 1), WAYPOINT_VIA_ICON_MAX_ORDER);
    return `/icons/flag_point=${String(n)}.png`;
  }
  return START_END_ICON[role];
}

export function getWaypointMarkerTitle(role: WaypointMarkerRole): string {
  return markerTitleByRole(role);
}
