import { useCallback, useRef } from 'react';

import type { TmapCoordinate, TmapMapLike, TmapMarkerLike, TmapV3 } from '@/commons/types/tmap';
import { getCourseSubmitMarkerIconUrl } from '@/commons/utils/marker/waypoint-marker';
import { getTmapv3Runtime } from '@/commons/utils/tmap/runtime';

import type { RefObject } from 'react';

export function useTmapOverlays(mapRef: RefObject<TmapMapLike | null>) {
  const markerRefs = useRef<TmapMarkerLike[]>([]);
  const polylineRef = useRef<{ setMap: (map: TmapMapLike | null) => void } | null>(null);

  const clearMarkers = useCallback(() => {
    markerRefs.current.forEach((marker) => marker.setMap(null));
    markerRefs.current = [];
  }, []);

  const drawPointMarkers = useCallback(
    (nextPoints: TmapCoordinate[]) => {
      const Tmapv3 = getTmapv3Runtime() as TmapV3 | undefined;
      const map = mapRef.current;
      if (!Tmapv3 || !map) return;

      clearMarkers();

      nextPoints.forEach((point, index) => {
        const marker = new Tmapv3.Marker({
          // Tmap 공식 예제와 동일하게 LatLng(lat, lon) 순서로 변환한다.
          position: new Tmapv3.LatLng(point.lat, point.lng),
          icon: getCourseSubmitMarkerIconUrl(index),
          map,
        });
        markerRefs.current.push(marker);
      });
    },
    [clearMarkers, mapRef],
  );

  const clearPolyline = useCallback(() => {
    polylineRef.current?.setMap(null);
    polylineRef.current = null;
  }, []);

  const drawRoutePolyline = useCallback(
    (path: TmapCoordinate[]) => {
      const Tmapv3 = getTmapv3Runtime() as TmapV3 | undefined;
      const map = mapRef.current;
      if (!Tmapv3 || !map) return;

      clearPolyline();

      const linePath = path.map((point) => new Tmapv3.LatLng(point.lat, point.lng));
      polylineRef.current = new Tmapv3.Polyline({
        path: linePath,
        strokeColor: '#2563EB',
        strokeWeight: 5,
        map,
      });
    },
    [clearPolyline, mapRef],
  );

  return {
    clearMarkers,
    drawPointMarkers,
    clearPolyline,
    drawRoutePolyline,
  };
}
