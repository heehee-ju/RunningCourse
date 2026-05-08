/**
 * 선택 코스 폴리라인의 로드/렌더/중복 요청 취소를 담당하는 훅.
 */

import { useCallback, useRef } from 'react';

import type { Route } from '@/commons/types/runroute';
import {
  dedupeConsecutiveCoordinates,
  extractPathCoordinates,
  extractSavedRoutePoints,
} from '@/components/tmap/course-detail/path-data';
import { getPedestrianRoute } from '@/repositories/map.repository';

import type { TmapLatLng, TmapMap, TmapPolyline, TmapV3API } from '../types';
import type { MutableRefObject } from 'react';

const ROUTE_POLYLINE_FIT_BOUNDS_PADDING_PX = 196;
const ROUTE_BOUNDS_INFLATE_RATIO = 1.42;
const ROUTE_BOUNDS_MIN_SPAN_LAT = 0.0088;
const ROUTE_BOUNDS_MIN_SPAN_LNG = 0.0112;
const ROUTE_POLYLINE_FIT_MAX_ZOOM_LEVEL = 15;

function padRouteBoundsForHomeFit(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const cLat = (minLat + maxLat) / 2;
  const cLng = (minLng + maxLng) / 2;
  let latSpan = maxLat - minLat;
  let lngSpan = maxLng - minLng;
  latSpan = Math.max(latSpan * ROUTE_BOUNDS_INFLATE_RATIO, ROUTE_BOUNDS_MIN_SPAN_LAT);
  lngSpan = Math.max(lngSpan * ROUTE_BOUNDS_INFLATE_RATIO, ROUTE_BOUNDS_MIN_SPAN_LNG);
  return {
    minLat: cLat - latSpan / 2,
    maxLat: cLat + latSpan / 2,
    minLng: cLng - lngSpan / 2,
    maxLng: cLng + lngSpan / 2,
  };
}

function clampRoutePolylineFitZoom(map: TmapMap): void {
  const z = map.getZoom?.();
  if (typeof z !== 'number') return;
  if (z > ROUTE_POLYLINE_FIT_MAX_ZOOM_LEVEL) {
    map.setZoom(ROUTE_POLYLINE_FIT_MAX_ZOOM_LEVEL);
  }
}

type UseSelectedRoutePolylineParams = {
  mapContainerId: string;
  routesRef: MutableRefObject<Route[]>;
  selectedRouteIdRef: MutableRefObject<string | null>;
  mapRef: MutableRefObject<TmapMap | null>;
  bottomSheetVisibleHeightRef: MutableRefObject<number>;
  getTmapv3: () => TmapV3API | undefined;
  clampHomeMapZoom: (map: TmapMap) => void;
  readCoordinateValue: (point: TmapLatLng | undefined, axis: 'lat' | 'lng') => number | null;
};

export function useSelectedRoutePolyline({
  mapContainerId,
  routesRef,
  selectedRouteIdRef,
  mapRef,
  bottomSheetVisibleHeightRef,
  getTmapv3,
  clampHomeMapZoom,
  readCoordinateValue,
}: UseSelectedRoutePolylineParams) {
  const selectedRoutePolylineRef = useRef<TmapPolyline | null>(null);
  const routePolylineGenerationRef = useRef(0);
  const routePolylineAbortRef = useRef<AbortController | null>(null);
  const selectedPolylineRetryTimerRef = useRef<number | null>(null);

  const clearSelectedRoutePolyline = useCallback(() => {
    routePolylineGenerationRef.current += 1;
    routePolylineAbortRef.current?.abort();
    routePolylineAbortRef.current = null;
    if (selectedPolylineRetryTimerRef.current !== null) {
      window.clearTimeout(selectedPolylineRetryTimerRef.current);
      selectedPolylineRetryTimerRef.current = null;
    }
    selectedRoutePolylineRef.current?.setMap(null);
    selectedRoutePolylineRef.current = null;
  }, []);

  const syncSelectedRoutePolyline = useCallback(
    (courseId: string | null, retryCount = 0) => {
      if (selectedPolylineRetryTimerRef.current !== null) {
        window.clearTimeout(selectedPolylineRetryTimerRef.current);
        selectedPolylineRetryTimerRef.current = null;
      }
      routePolylineGenerationRef.current += 1;
      const generation = routePolylineGenerationRef.current;

      routePolylineAbortRef.current?.abort();
      routePolylineAbortRef.current = null;

      if (!courseId) {
        selectedRoutePolylineRef.current?.setMap(null);
        selectedRoutePolylineRef.current = null;
        return;
      }

      const map = mapRef.current;
      const Tmapv3 = getTmapv3();
      if (!map || !Tmapv3) {
        if (retryCount < 2) {
          selectedPolylineRetryTimerRef.current = window.setTimeout(() => {
            selectedPolylineRetryTimerRef.current = null;
            if (selectedRouteIdRef.current !== courseId) return;
            syncSelectedRoutePolyline(courseId, retryCount + 1);
          }, 120);
        }
        return;
      }

      const route = routesRef.current.find((item) => item.id === courseId);
      if (!route) {
        if (retryCount < 2) {
          selectedPolylineRetryTimerRef.current = window.setTimeout(() => {
            selectedPolylineRetryTimerRef.current = null;
            if (selectedRouteIdRef.current !== courseId) return;
            syncSelectedRoutePolyline(courseId, retryCount + 1);
          }, 120);
        }
        return;
      }

      const fallbackLine = dedupeConsecutiveCoordinates(
        extractPathCoordinates(route.path_data, route.id),
      );
      const savedPoints = extractSavedRoutePoints(route.path_data);

      const abortController = new AbortController();
      routePolylineAbortRef.current = abortController;

      const isStale = (): boolean =>
        generation !== routePolylineGenerationRef.current ||
        selectedRouteIdRef.current !== courseId;

      void (async () => {
        let lineCoordinates = fallbackLine;

        if (savedPoints.length >= 2) {
          try {
            const coordsForApi = savedPoints.map((p) => ({ lat: p.lat, lng: p.lng }));
            const result = await getPedestrianRoute(coordsForApi, abortController.signal);
            const next = dedupeConsecutiveCoordinates(
              result.path
                .map((c) => ({ lat: Number(c.lat), lng: Number(c.lng) }))
                .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng)),
            );
            if (next.length >= 2) {
              lineCoordinates = next;
            }
          } catch (error) {
            if (abortController.signal.aborted) return;
            // eslint-disable-next-line no-console
            console.warn('[TmapHome] 보행자 경로 재계산 실패, 저장 path 사용:', error);
          }
        }

        if (isStale()) return;

        const liveMap = mapRef.current;
        const liveTmap = getTmapv3();
        if (!liveMap || !liveTmap || lineCoordinates.length < 2) return;

        const latLngPath = lineCoordinates.map(
          (coordinate) => new liveTmap.LatLng(coordinate.lat, coordinate.lng),
        );
        const previousPolyline = selectedRoutePolylineRef.current;
        const nextPolyline = new liveTmap.Polyline({
          map: liveMap,
          path: latLngPath,
          strokeColor: '#2F80FF',
          strokeWeight: 6,
          strokeOpacity: 0.95,
        });
        selectedRoutePolylineRef.current = nextPolyline;
        previousPolyline?.setMap(null);

        if (typeof liveMap.fitBounds !== 'function') return;

        const latValues = lineCoordinates.map((c) => c.lat);
        const lngValues = lineCoordinates.map((c) => c.lng);
        const rawMinLat = Math.min(...latValues);
        const rawMaxLat = Math.max(...latValues);
        const rawMinLng = Math.min(...lngValues);
        const rawMaxLng = Math.max(...lngValues);
        const rawCenterLat = (rawMinLat + rawMaxLat) / 2;
        const rawCenterLng = (rawMinLng + rawMaxLng) / 2;
        const padded = padRouteBoundsForHomeFit(rawMinLat, rawMaxLat, rawMinLng, rawMaxLng);
        const southWest = new liveTmap.LatLng(padded.minLat, padded.minLng);
        const northEast = new liveTmap.LatLng(padded.maxLat, padded.maxLng);

        const LatLngBounds = (
          liveTmap as unknown as { LatLngBounds?: new (sw: unknown, ne: unknown) => unknown }
        ).LatLngBounds;
        if (typeof LatLngBounds === 'function') {
          const bounds = new LatLngBounds(southWest, northEast);
          liveMap.fitBounds(bounds, ROUTE_POLYLINE_FIT_BOUNDS_PADDING_PX);
        } else {
          liveMap.fitBounds(southWest, northEast);
        }

        requestAnimationFrame(() => {
          if (isStale()) return;
          const mapAfterFit = mapRef.current;
          const tmapAfterFit = getTmapv3();
          if (!mapAfterFit || !tmapAfterFit) return;

          const mapElement = document.getElementById(mapContainerId);
          const mapHeightPx = mapElement?.clientHeight ?? 0;
          if (mapHeightPx <= 0) return;

          const overlayPx = Math.min(Math.max(0, bottomSheetVisibleHeightRef.current), mapHeightPx);
          if (overlayPx <= 0) return;

          const boundsAfterFit = mapAfterFit.getBounds?.();
          const northEastAfterFit = boundsAfterFit?.getNorthEast?.();
          const southWestAfterFit = boundsAfterFit?.getSouthWest?.();
          if (!boundsAfterFit || !northEastAfterFit || !southWestAfterFit) return;

          const northEastLat = readCoordinateValue(northEastAfterFit, 'lat');
          const southWestLat = readCoordinateValue(southWestAfterFit, 'lat');
          if (northEastLat === null || southWestLat === null) return;

          const latSpan = northEastLat - southWestLat;
          if (!Number.isFinite(latSpan) || latSpan <= 0) return;

          // 바텀시트로 가려진 높이를 반영해 폴리라인 중심을 시각적 중앙으로 보정한다.
          const latOffset = (overlayPx / 2 / mapHeightPx) * latSpan;
          mapAfterFit.setCenter(new tmapAfterFit.LatLng(rawCenterLat - latOffset, rawCenterLng));
        });

        clampRoutePolylineFitZoom(liveMap);
        clampHomeMapZoom(liveMap);
      })();
    },
    [
      bottomSheetVisibleHeightRef,
      clampHomeMapZoom,
      getTmapv3,
      mapContainerId,
      mapRef,
      readCoordinateValue,
      routesRef,
      selectedRouteIdRef,
    ],
  );

  return {
    syncSelectedRoutePolyline,
    clearSelectedRoutePolyline,
  };
}
