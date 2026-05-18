/**
 * 홈 지도 뷰포트 리포팅(전체/가시 영역) 계산 및 디바운스 처리 훅.
 */

import { useCallback, useRef } from 'react';

import type { RouteViewport } from '@/commons/types/routerun';
import type { TmapLatLng, TmapMap } from '@/commons/utils/tmap/types';
import { computeVisibleRouteViewportFromMapCanvas } from '@/commons/utils/viewport/map-canvas';

import type { MutableRefObject } from 'react';

type UseViewportReporterParams = {
  mapContainerId: string;
  bottomSheetVisibleHeightRef: MutableRefObject<number>;
  /** true면 쿼리/가시 뷰포트를 부모로 올리지 않음(마우스 팬 등) */
  isViewportReportSuppressed?: () => boolean;
  onViewportChanged?: (viewport: RouteViewport) => void;
  onVisibleViewportChanged?: (viewport: RouteViewport | null) => void;
  isDebugEnabled: () => boolean;
  readCoordinateValue: (point: TmapLatLng | undefined, axis: 'lat' | 'lng') => number | null;
};

function isSameRouteViewport(left: RouteViewport | null, right: RouteViewport | null): boolean {
  if (!left || !right) return false;
  return (
    left.northEastLat === right.northEastLat &&
    left.northEastLng === right.northEastLng &&
    left.southWestLat === right.southWestLat &&
    left.southWestLng === right.southWestLng
  );
}

export function useViewportReporter({
  mapContainerId,
  bottomSheetVisibleHeightRef,
  isViewportReportSuppressed,
  onViewportChanged,
  onVisibleViewportChanged,
  isDebugEnabled,
  readCoordinateValue,
}: UseViewportReporterParams) {
  const viewportReportTimerRef = useRef<number | null>(null);
  const lastQueryViewportRef = useRef<RouteViewport | null>(null);
  const lastVisibleViewportReportRef = useRef<RouteViewport | null>(null);

  const readMapBoundsViewport = useCallback(
    (map: TmapMap): RouteViewport | null => {
      const bounds = map.getBounds?.();
      if (!bounds) return null;
      const northEast = bounds.getNorthEast?.();
      const southWest = bounds.getSouthWest?.();
      if (!northEast || !southWest) return null;
      const northEastLat = readCoordinateValue(northEast, 'lat');
      const northEastLng = readCoordinateValue(northEast, 'lng');
      const southWestLat = readCoordinateValue(southWest, 'lat');
      const southWestLng = readCoordinateValue(southWest, 'lng');
      if (
        northEastLat === null ||
        northEastLng === null ||
        southWestLat === null ||
        southWestLng === null
      ) {
        return null;
      }
      return { northEastLat, northEastLng, southWestLat, southWestLng };
    },
    [readCoordinateValue],
  );

  const computeVisibleViewportFromMap = useCallback(
    (map: TmapMap): RouteViewport | null => {
      const base = readMapBoundsViewport(map);
      if (!base) return null;

      const mapElement = document.getElementById(mapContainerId);
      const mapWidthPx = mapElement?.clientWidth ?? 0;
      const mapHeightPx = mapElement?.clientHeight ?? 0;
      if (mapWidthPx <= 0 || mapHeightPx <= 0) {
        return null;
      }

      const overlayPx = Math.min(Math.max(0, bottomSheetVisibleHeightRef.current), mapHeightPx);
      return computeVisibleRouteViewportFromMapCanvas({
        northEastLat: base.northEastLat,
        northEastLng: base.northEastLng,
        southWestLat: base.southWestLat,
        southWestLng: base.southWestLng,
        mapWidthPx,
        mapHeightPx,
        bottomOverlayPx: overlayPx,
      });
    },
    [bottomSheetVisibleHeightRef, mapContainerId, readMapBoundsViewport],
  );

  const emitViewportReports = useCallback(
    (map: TmapMap) => {
      if (isViewportReportSuppressed?.()) {
        return;
      }

      let queryEmitted = false;
      let visibleEmitted = false;

      const queryVp = readMapBoundsViewport(map);
      if (queryVp) {
        const prev = lastQueryViewportRef.current;
        if (!isSameRouteViewport(prev, queryVp)) {
          lastQueryViewportRef.current = queryVp;
          onViewportChanged?.(queryVp);
          queryEmitted = true;
        }
      }

      const visibleVp = computeVisibleViewportFromMap(map);
      if (visibleVp) {
        const prevV = lastVisibleViewportReportRef.current;
        if (!isSameRouteViewport(prevV, visibleVp)) {
          lastVisibleViewportReportRef.current = visibleVp;
          onVisibleViewportChanged?.(visibleVp);
          visibleEmitted = true;
        }
      }

      if (isDebugEnabled() && (queryEmitted || visibleEmitted)) {
        // 디버그 모드에서는 report 발생 시점을 묶어서 확인한다.
        // eslint-disable-next-line no-console
        console.info('[TmapHome:lifecycle] emitViewportReports', {
          queryEmitted,
          visibleEmitted,
          resizeAvailable: typeof map.resize === 'function',
        });
      }
    },
    [
      computeVisibleViewportFromMap,
      isDebugEnabled,
      onViewportChanged,
      onVisibleViewportChanged,
      readMapBoundsViewport,
      isViewportReportSuppressed,
    ],
  );

  const emitVisibleViewportReportOnly = useCallback(
    (map: TmapMap) => {
      const visibleVp = computeVisibleViewportFromMap(map);
      if (!visibleVp) return;
      const prevV = lastVisibleViewportReportRef.current;
      if (isSameRouteViewport(prevV, visibleVp)) return;
      lastVisibleViewportReportRef.current = visibleVp;
      onVisibleViewportChanged?.(visibleVp);
    },
    [computeVisibleViewportFromMap, onVisibleViewportChanged],
  );

  const scheduleViewportReport = useCallback(
    (map: TmapMap, delay = 220) => {
      if (viewportReportTimerRef.current !== null) {
        window.clearTimeout(viewportReportTimerRef.current);
      }
      viewportReportTimerRef.current = window.setTimeout(() => {
        if (isViewportReportSuppressed?.()) {
          viewportReportTimerRef.current = null;
          return;
        }
        emitViewportReports(map);
      }, delay);
    },
    [emitViewportReports, isViewportReportSuppressed],
  );

  const clearViewportReporterState = useCallback(() => {
    if (viewportReportTimerRef.current !== null) {
      window.clearTimeout(viewportReportTimerRef.current);
      viewportReportTimerRef.current = null;
    }
    lastQueryViewportRef.current = null;
    lastVisibleViewportReportRef.current = null;
  }, []);

  return {
    emitViewportReports,
    emitVisibleViewportReportOnly,
    scheduleViewportReport,
    clearViewportReporterState,
  };
}
