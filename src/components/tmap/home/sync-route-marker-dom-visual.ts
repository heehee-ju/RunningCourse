/**
 * 홈 코스 마커 DOM에 `data-route-marker-visual`을 맞춰 styles.module.css의 필터·스케일과 동기화한다.
 */

import type { MarkerVisualState } from '@/commons/utils/marker/route-marker';
import type { TmapMarker } from '@/commons/utils/tmap/types';

export function syncRouteMarkerDomVisualState(marker: TmapMarker, state: MarkerVisualState): void {
  const root = marker.getElement?.();
  if (!(root instanceof HTMLElement)) return;
  root.setAttribute('data-route-marker-visual', state);
}
