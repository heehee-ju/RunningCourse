export type WaypointMarkerRole = 'start' | 'via' | 'end';

export type WaypointMarkerIconOptions = {
  /** 왕복 코스일 때 마지막 저장 지점은 도착이 아닌 반환 지점으로 표시 */
  isRoundTrip?: boolean | null;
};

/** 경유지 순번별 깃발 (`flag_point=1` … `flag_point=5`); 6번째 이상은 5번 아이콘으로 표시 */
export const WAYPOINT_VIA_ICON_MAX_ORDER = 5;

const START_END_ICON: Record<Exclude<WaypointMarkerRole, 'via'>, string> = {
  start: '/assets/icons/courses-point/flag_start.png',
  end: '/assets/icons/courses-point/flag_finish.png',
};

function markerTitleByRole(role: WaypointMarkerRole): string {
  if (role === 'start') return '출발지';
  if (role === 'end') return '도착지';
  return '경유지';
}

/**
 * @param viaOrder 경유지일 때만 사용. 출발지 인덱스 0 기준으로 첫 경유지는 `1`(=`points` 배열 인덱스).
 */
export function getWaypointMarkerIconUrl(
  role: WaypointMarkerRole,
  viaOrder?: number,
  options?: WaypointMarkerIconOptions,
): string {
  if (role === 'via') {
    const raw = viaOrder ?? 1;
    const n = Math.min(Math.max(Math.trunc(raw), 1), WAYPOINT_VIA_ICON_MAX_ORDER);
    return `/assets/icons/courses-point/flag_point=${String(n)}.png`;
  }
  if (role === 'end' && options?.isRoundTrip) {
    return '/assets/icons/courses-point/flag_turn.png';
  }
  return START_END_ICON[role];
}

export function getWaypointMarkerTitle(role: WaypointMarkerRole): string {
  return markerTitleByRole(role);
}

const COURSE_SUBMIT_POINTER_MAX = 7;

export function getCourseSubmitMarkerIconUrl(pointIndex: number): string {
  const n = Math.min(Math.max(Math.trunc(pointIndex) + 1, 1), COURSE_SUBMIT_POINTER_MAX);
  return `/assets/icons/courses-point/pointer${String(n)}.png`;
}
