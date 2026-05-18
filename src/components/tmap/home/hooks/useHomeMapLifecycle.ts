/**
 * 홈 Tmap의 초기 생성/위치 기반 시작/정리(cleanup)를 담당하는 훅.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Route, RouteViewport } from '@/commons/types/routerun';
import {
  getCurrentPositionWithFallback,
  PRECISE_GEOLOCATION_OPTIONS,
} from '@/commons/utils/geo/geolocation';
import type {
  RouteMarkerEntry,
  TmapMap,
  TmapMarker,
  TmapMarkerCluster,
  TmapV3API,
} from '@/commons/utils/tmap/types';

import type { MutableRefObject } from 'react';

const INITIAL_MAP_ZOOM_LEVEL = 14;
const SDK_READY_RETRY_DELAY_MS = 120;

type UseHomeMapLifecycleParams = {
  mapContainerId: string;
  initialViewport: RouteViewport | null;
  routesRef: MutableRefObject<Route[]>;
  mapRef: MutableRefObject<TmapMap | null>;
  currentLocationMarkerRef: MutableRefObject<TmapMarker | null>;
  currentLocationCoordinateRef: MutableRefObject<{ lat: number; lng: number } | null>;
  routeMarkerMapRef: MutableRefObject<Map<string, RouteMarkerEntry>>;
  routeMarkerClusterRef: MutableRefObject<TmapMarkerCluster | null>;
  mapListenersRegisteredRef: MutableRefObject<boolean>;
  isMapInteractingRef: MutableRefObject<boolean>;
  interactionWatchdogTimerRef: MutableRefObject<number | null>;
  viewportSyncIntervalRef: MutableRefObject<number | null>;
  zoomUpdateRafRef: MutableRefObject<number | null>;
  markerVisibilityTimerRef: MutableRefObject<number | null>;
  selectedRouteIdRef: MutableRefObject<string | null>;
  markerHoverCountRef: MutableRefObject<number>;
  lastAppliedZoomRef: MutableRefObject<number | null>;
  clearSelectedRoutePolyline: () => void;
  clearViewportReporterState: () => void;
  clearZoomControlState: () => void;
  getTmapv3: () => TmapV3API | undefined;
  minZoomLevel: number;
  maxZoomLevel: number;
  createCurrentLocationMarker: (map: TmapMap, lat: number, lng: number) => void;
  centerMapToLocationInVisibleArea: (map: TmapMap, lat: number, lng: number) => void;
  applyInitialViewport: (map: TmapMap) => void;
  enforceMinZoomLevel: (map: TmapMap) => number | null;
  registerMapListeners: (map: TmapMap) => void;
  scheduleViewportReport: (map: TmapMap, delay?: number) => void;
  scheduleMarkerVisibilitySync: (map: TmapMap) => void;
  emitViewportReports: (map: TmapMap) => void;
  syncRouteMarkers: (map: TmapMap, nextRoutes: Route[]) => void;
  /** 뷰포트 리포트(쿼리·토스트 연동)를 잠시 막을 때 true — SDK idle과 포인터 누름을 함께 쓴다 */
  isViewportReportSuppressed?: () => boolean;
};

export function useHomeMapLifecycle({
  mapContainerId,
  initialViewport,
  routesRef,
  mapRef,
  currentLocationMarkerRef,
  currentLocationCoordinateRef,
  routeMarkerMapRef,
  routeMarkerClusterRef,
  mapListenersRegisteredRef,
  isMapInteractingRef,
  interactionWatchdogTimerRef,
  viewportSyncIntervalRef,
  zoomUpdateRafRef,
  markerVisibilityTimerRef,
  selectedRouteIdRef,
  markerHoverCountRef,
  lastAppliedZoomRef,
  clearSelectedRoutePolyline,
  clearViewportReporterState,
  clearZoomControlState,
  getTmapv3,
  minZoomLevel,
  maxZoomLevel,
  createCurrentLocationMarker,
  centerMapToLocationInVisibleArea,
  applyInitialViewport,
  enforceMinZoomLevel,
  registerMapListeners,
  scheduleViewportReport,
  scheduleMarkerVisibilitySync,
  emitViewportReports,
  syncRouteMarkers,
  isViewportReportSuppressed,
}: UseHomeMapLifecycleParams) {
  const [mapReadyToken, setMapReadyToken] = useState(0);
  const hasAppliedInitialViewportRef = useRef(false);

  const handleRefreshLocation = useCallback(() => {
    const map = mapRef.current;
    if (!map || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        centerMapToLocationInVisibleArea(map, latitude, longitude);
        createCurrentLocationMarker(map, latitude, longitude);
      },
      (error) => {
        // eslint-disable-next-line no-console
        console.error('위치 갱신 실패:', error);
        alert('위치 정보를 가져올 수 없습니다.');
      },
      PRECISE_GEOLOCATION_OPTIONS,
    );
  }, [centerMapToLocationInVisibleArea, createCurrentLocationMarker, mapRef]);

  useEffect(() => {
    let cancelled = false;
    let sdkRetryTimerId: number | null = null;
    let sdkRetryCount = 0;

    function scheduleSdkRetry() {
      if (cancelled) return;
      if (sdkRetryTimerId !== null) {
        window.clearTimeout(sdkRetryTimerId);
      }
      sdkRetryTimerId = window.setTimeout(checkLibrary, SDK_READY_RETRY_DELAY_MS);
    }

    const isTmapRuntimeReady = (runtime: TmapV3API | undefined): runtime is TmapV3API => {
      if (!runtime) return false;
      return typeof runtime.Map === 'function' && typeof runtime.LatLng === 'function';
    };

    const initTmap = (lat: number, lng: number) => {
      if (cancelled) return;
      const Tmapv3 = getTmapv3();
      if (!isTmapRuntimeReady(Tmapv3) || mapRef.current) return;

      let map: TmapMap;
      try {
        map = new Tmapv3.Map(mapContainerId, {
          center: new Tmapv3.LatLng(lat, lng),
          width: '100%',
          height: '100%',
          zoom: INITIAL_MAP_ZOOM_LEVEL,
          minZoom: minZoomLevel,
          zoomControl: false,
          scrollwheel: false,
        });
      } catch (error) {
        // SDK 전역이 먼저 생기고 생성자가 늦게 준비되는 레이스를 흡수한다.
        // eslint-disable-next-line no-console
        console.error('[TmapHome] SDK 초기화 실패, 재시도 예정:', error);
        scheduleSdkRetry();
        return;
      }

      map.setZoomLimit?.(minZoomLevel, maxZoomLevel);
      lastAppliedZoomRef.current = map.getZoom();
      createCurrentLocationMarker(map, lat, lng);
      mapRef.current = map;
      setMapReadyToken((previous) => previous + 1);

      if (!initialViewport) {
        centerMapToLocationInVisibleArea(map, lat, lng);
      }

      // 초기 viewport는 최초 1회만 적용한다.
      if (!hasAppliedInitialViewportRef.current) {
        applyInitialViewport(map);
        hasAppliedInitialViewportRef.current = true;
      }

      enforceMinZoomLevel(map);
      registerMapListeners(map);
      scheduleViewportReport(map, 500);

      if (viewportSyncIntervalRef.current !== null) {
        window.clearInterval(viewportSyncIntervalRef.current);
      }
      viewportSyncIntervalRef.current = window.setInterval(() => {
        if (!isMapInteractingRef.current) {
          scheduleMarkerVisibilitySync(map);
        }
        if (!isViewportReportSuppressed?.()) {
          emitViewportReports(map);
        }
      }, 450);

      syncRouteMarkers(map, routesRef.current);
    };

    const startWithLocation = () => {
      getCurrentPositionWithFallback((lat, lng) => {
        initTmap(lat, lng);
      });
    };

    function checkLibrary() {
      if (isTmapRuntimeReady(getTmapv3())) {
        sdkRetryCount = 0;
        startWithLocation();
      } else {
        sdkRetryCount += 1;
        if (sdkRetryCount % 25 === 0) {
          // eslint-disable-next-line no-console
          console.warn('[TmapHome] Tmap SDK 로딩 대기 중...');
        }
        scheduleSdkRetry();
      }
    }

    checkLibrary();

    const routeMarkerMap = routeMarkerMapRef.current;
    return () => {
      cancelled = true;
      if (sdkRetryTimerId !== null) {
        window.clearTimeout(sdkRetryTimerId);
        sdkRetryTimerId = null;
      }

      const clusterOnUnmount = routeMarkerClusterRef.current;
      if (clusterOnUnmount && typeof clusterOnUnmount.clearMarkers === 'function') {
        try {
          clusterOnUnmount.clearMarkers();
        } catch {
          /* noop */
        }
      }
      clusterOnUnmount?.setMap?.(null);
      routeMarkerClusterRef.current = null;

      routeMarkerMap.forEach((entry) => {
        entry.marker.setMap(null);
      });
      routeMarkerMap.clear();

      clearSelectedRoutePolyline();
      mapRef.current = null;
      currentLocationMarkerRef.current = null;
      currentLocationCoordinateRef.current = null;
      selectedRouteIdRef.current = null;
      markerHoverCountRef.current = 0;
      mapListenersRegisteredRef.current = false;
      isMapInteractingRef.current = false;

      if (interactionWatchdogTimerRef.current !== null) {
        window.clearTimeout(interactionWatchdogTimerRef.current);
        interactionWatchdogTimerRef.current = null;
      }
      if (viewportSyncIntervalRef.current !== null) {
        window.clearInterval(viewportSyncIntervalRef.current);
        viewportSyncIntervalRef.current = null;
      }
      clearZoomControlState();
      if (zoomUpdateRafRef.current !== null) {
        window.cancelAnimationFrame(zoomUpdateRafRef.current);
        zoomUpdateRafRef.current = null;
      }
      if (markerVisibilityTimerRef.current !== null) {
        window.clearTimeout(markerVisibilityTimerRef.current);
        markerVisibilityTimerRef.current = null;
      }
      lastAppliedZoomRef.current = null;
      clearViewportReporterState();
    };
  }, [
    applyInitialViewport,
    centerMapToLocationInVisibleArea,
    clearSelectedRoutePolyline,
    clearViewportReporterState,
    clearZoomControlState,
    createCurrentLocationMarker,
    emitViewportReports,
    enforceMinZoomLevel,
    getTmapv3,
    initialViewport,
    isMapInteractingRef,
    interactionWatchdogTimerRef,
    lastAppliedZoomRef,
    mapContainerId,
    mapListenersRegisteredRef,
    mapRef,
    markerHoverCountRef,
    markerVisibilityTimerRef,
    maxZoomLevel,
    minZoomLevel,
    registerMapListeners,
    routeMarkerClusterRef,
    routeMarkerMapRef,
    routesRef,
    scheduleMarkerVisibilitySync,
    scheduleViewportReport,
    selectedRouteIdRef,
    syncRouteMarkers,
    viewportSyncIntervalRef,
    zoomUpdateRafRef,
    currentLocationMarkerRef,
    currentLocationCoordinateRef,
    isViewportReportSuppressed,
  ]);

  useEffect(() => {
    hasAppliedInitialViewportRef.current = false;
  }, [initialViewport]);

  return {
    mapReadyToken,
    handleRefreshLocation,
  };
}
