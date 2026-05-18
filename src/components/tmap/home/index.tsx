'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Icon } from '@/commons/components/icons';
import type { Route, RouteViewport } from '@/commons/types/routerun';
import { bindMapEvents } from '@/commons/utils/tmap/events';
import { getTmapv3Runtime } from '@/commons/utils/tmap/runtime';
import type {
  RouteMarkerEntry,
  TmapLatLng,
  TmapMap,
  TmapMarker,
  TmapMarkerCluster,
} from '@/commons/utils/tmap/types';
import { useCurrentLocationMarker } from '@/components/tmap/commons/hooks/useCurrentLocationMarker';

import { useHomeMapLifecycle } from './hooks/useHomeMapLifecycle';
import { useMapZoomControls } from './hooks/useMapZoomControls';
import { useRouteMarkers } from './hooks/useRouteMarkers';
import { useSelectedRoutePolyline } from './hooks/useSelectedRoutePolyline';
import { useViewportReporter } from './hooks/useViewportReporter';
import styles from './styles.module.css';

/** 줌 시 마커 위경도 디버그 로그. 끄기: `localStorage.DEBUG_TMAP_MARKERS=0` · 항상 켜기: `=1` */
function isMarkerCoordDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const flag = window.localStorage?.getItem('DEBUG_TMAP_MARKERS');
  if (flag === '0') return false;
  return flag === '1';
}

/** 마커/클러스터 생명주기·부착 상태 로그. 켜기: `localStorage.DEBUG_TMAP_MARKER_LIFECYCLE=1` · 끄기: `=0` */
function isMarkerLifecycleDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const flag = window.localStorage?.getItem('DEBUG_TMAP_MARKER_LIFECYCLE');
  if (flag === '0') return false;
  return flag === '1';
}

/** SDK 마커가 현재 어떤 map 인스턴스에 붙었는지(가능할 때만) */
function tryReadMarkerAttachedMap(marker: unknown): unknown {
  if (!marker || typeof marker !== 'object') return undefined;
  const candidate = marker as { getMap?: () => unknown; map?: unknown };
  if (typeof candidate.getMap === 'function') {
    try {
      return candidate.getMap();
    } catch {
      return undefined;
    }
  }
  return candidate.map;
}

/** routes props 동일 여부 판별용 (참조가 바뀌어도 내용 같으면 syncRouteMarkers 스킵) */
function buildRoutesSyncSignature(routes: Route[]): string {
  return routes
    .map(
      (r) => `${r.id}:${String(r.start_lat)}:${String(r.start_lng)}:${String(r.distance_meters)}`,
    )
    .sort()
    .join('|');
}

function roundCoordForLog(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

type TmapHomeProps = {
  bottomSheetVisibleHeight?: number;
  /** 실제 보이는 시트 높이(플로팅 컨트롤 bottom). 미지정 시 bottomSheetVisibleHeight와 동일 */
  bottomSheetVisualVisibleHeight?: number;
  isBottomSheetExpanded?: boolean;
  routes?: Route[];
  initialViewport?: RouteViewport | null;
  selectedCourseId?: string | null;
  /** 마커 클릭 시마다 증가 — 보이는 지도 영역 기준 1회 중앙 정렬에만 사용 */
  markerClickRecenterToken?: number;
  onCourseMarkerClick?: (courseId: string, route: Route) => void;
  /** 데이터 필터용 — 전체 지도 bounds(getBounds), 바텀시트 오버레이 미반영 */
  onViewportChanged?: (viewport: RouteViewport) => void;
  /** UI용 — 바텀시트가 가리지 않는 영역 근사 bounds */
  onVisibleViewportChanged?: (viewport: RouteViewport | null) => void;
  onZoomLimitReached?: (limit: 'min' | 'max') => void;
  onZoomLimitCleared?: () => void;
  onDragSettled?: () => void;
};

const MIN_ZOOM_LEVEL = 8;
const MAX_ZOOM_LEVEL = 19;

function clampHomeMapZoom(map: TmapMap): void {
  const currentZoom = map.getZoom?.();
  if (typeof currentZoom !== 'number') return;
  const clamped = Math.min(MAX_ZOOM_LEVEL, Math.max(MIN_ZOOM_LEVEL, currentZoom));
  if (clamped !== currentZoom) {
    map.setZoom(clamped);
  }
}

export function TmapHome({
  bottomSheetVisibleHeight = 24,
  bottomSheetVisualVisibleHeight,
  isBottomSheetExpanded = false,
  routes = [],
  initialViewport = null,
  selectedCourseId = null,
  markerClickRecenterToken = 0,
  onCourseMarkerClick,
  onViewportChanged,
  onVisibleViewportChanged,
  onZoomLimitReached,
  onZoomLimitCleared,
  onDragSettled,
}: TmapHomeProps) {
  const [isMobileOrTabletViewport, setIsMobileOrTabletViewport] = useState(false);
  // [상태] 지도/마커 인스턴스 참조 관리
  const mapInstance = useRef<TmapMap | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { createCurrentLocationMarker, currentLocationMarkerRef, currentLocationCoordinateRef } =
    useCurrentLocationMarker();
  const routeMarkerMapRef = useRef<Map<string, RouteMarkerEntry>>(new Map());
  const routeMarkerClusterRef = useRef<TmapMarkerCluster | null>(null);
  /** 코스 마커 인스턴스 집합이 바뀔 때마다 증가 → 클러스터 재부착 필요 */
  const routeMarkerClusterGenerationRef = useRef(0);
  const routesRef = useRef<Route[]>(routes);
  /** syncRouteMarkers 가 실제 데이터 변경 시에만 돌도록 마지막 동기화 서명 */
  const routesSyncSigRef = useRef<string | null>(null);
  const selectedRouteIdRef = useRef<string | null>(null);
  const selectedRouteDataReadyRef = useRef(false);
  const viewportSyncIntervalRef = useRef<number | null>(null);
  const mapListenersRegisteredRef = useRef(false);
  const zoomUpdateRafRef = useRef<number | null>(null);
  const markerVisibilityTimerRef = useRef<number | null>(null);
  const isMapInteractingRef = useRef(false);
  const interactionWatchdogTimerRef = useRef<number | null>(null);
  /** map_div에서 포인터가 눌린 동안(마우스 팬 등) — SDK idle이 먼저 와도 뷰포트 리포트를 막는다 */
  const isPrimaryPointerDownOnMapRef = useRef(false);

  const isViewportReportSuppressed = useCallback(
    () => isMapInteractingRef.current || isPrimaryPointerDownOnMapRef.current,
    [],
  );
  const lastAppliedZoomRef = useRef<number | null>(null);
  const markerHoverCountRef = useRef(0);
  const bottomSheetVisibleHeightRef = useRef(bottomSheetVisibleHeight);
  bottomSheetVisibleHeightRef.current = bottomSheetVisibleHeight;
  const sheetChromeBottomHeight = bottomSheetVisualVisibleHeight ?? bottomSheetVisibleHeight;
  const lastMapContainerSizeRef = useRef<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const setMarkerHoverCursor = useCallback((isHover: boolean) => {
    const rootElement = rootRef.current;
    if (!rootElement) return;

    if (isHover) {
      markerHoverCountRef.current += 1;
    } else {
      markerHoverCountRef.current = Math.max(0, markerHoverCountRef.current - 1);
    }

    rootElement.classList.toggle(styles.mapMarkerHover, markerHoverCountRef.current > 0);
  }, []);

  const readCoordinateValue = useCallback(
    (point: TmapLatLng | undefined, axis: 'lat' | 'lng'): number | null => {
      if (!point) return null;
      const rawValue = axis === 'lat' ? point.lat : point.lng;
      if (typeof rawValue === 'function') {
        const methodValue = rawValue();
        if (typeof methodValue === 'number') return methodValue;
      }
      if (typeof rawValue === 'number') return rawValue;
      const fallback =
        axis === 'lat' ? (point._lat ?? point.latValue) : (point._lng ?? point.lngValue);
      return typeof fallback === 'number' ? fallback : null;
    },
    [],
  );

  const tryReadSdkLatLngFromMarker = useCallback(
    (marker: TmapMarker) => {
      if (typeof marker.getPosition !== 'function') return null;
      try {
        const point = marker.getPosition();
        const lat = readCoordinateValue(point, 'lat');
        const lng = readCoordinateValue(point, 'lng');
        if (lat !== null && lng !== null) return { lat, lng };
      } catch {
        /* SDK 버전별 미구현 */
      }
      return null;
    },
    [readCoordinateValue],
  );

  const {
    emitViewportReports,
    emitVisibleViewportReportOnly,
    scheduleViewportReport,
    clearViewportReporterState,
  } = useViewportReporter({
    mapContainerId: 'map_div',
    bottomSheetVisibleHeightRef,
    isViewportReportSuppressed,
    onViewportChanged,
    onVisibleViewportChanged,
    isDebugEnabled: isMarkerLifecycleDebugEnabled,
    readCoordinateValue,
  });

  const {
    enforceMinZoomLevel,
    notifyZoomLimitState,
    adjustZoomLevel,
    handleMapWheel,
    clearZoomControlState,
  } = useMapZoomControls({
    mapRef: mapInstance,
    scheduleViewportReport,
    onZoomLimitReached,
    onZoomLimitCleared,
  });

  const centerMapToLocationInVisibleArea = useCallback(
    (map: TmapMap, lat: number, lng: number) => {
      const Tmapv3 = getTmapv3Runtime();
      if (!Tmapv3) return;
      map.setCenter(new Tmapv3.LatLng(lat, lng));

      requestAnimationFrame(() => {
        const liveTmap = getTmapv3Runtime();
        if (!liveTmap) return;
        const mapElement = document.getElementById('map_div');
        const mapHeightPx = mapElement?.clientHeight ?? 0;
        if (mapHeightPx <= 0) return;

        const overlayPx = Math.min(Math.max(0, bottomSheetVisibleHeightRef.current), mapHeightPx);
        if (overlayPx <= 0) return;

        const bounds = map.getBounds?.();
        const northEast = bounds?.getNorthEast?.();
        const southWest = bounds?.getSouthWest?.();
        if (!bounds || !northEast || !southWest) return;

        const northEastLat = readCoordinateValue(northEast, 'lat');
        const southWestLat = readCoordinateValue(southWest, 'lat');
        if (northEastLat === null || southWestLat === null) return;

        const latSpan = northEastLat - southWestLat;
        if (!Number.isFinite(latSpan) || latSpan <= 0) return;

        // 바텀시트가 가리는 하단만큼, 지도 중심을 남쪽으로 내려야 타깃이 시각적 중앙(위쪽)으로 올라온다.
        const latOffset = (overlayPx / 2 / mapHeightPx) * latSpan;
        map.setCenter(new liveTmap.LatLng(lat - latOffset, lng));
      });
    },
    [readCoordinateValue],
  );

  const { syncSelectedRoutePolyline, clearSelectedRoutePolyline } = useSelectedRoutePolyline({
    mapContainerId: 'map_div',
    routesRef,
    selectedRouteIdRef,
    mapRef: mapInstance,
    bottomSheetVisibleHeightRef,
    getTmapv3: getTmapv3Runtime,
    clampHomeMapZoom,
  });

  const {
    syncRouteMarkersDisplayForZoom: syncRouteMarkersDisplayForZoomByHook,
    scheduleMarkerVisibilitySync: scheduleMarkerVisibilitySyncByHook,
    syncSelectedMarkerVisual: syncSelectedMarkerVisualByHook,
    syncRouteMarkers: syncRouteMarkersByHook,
  } = useRouteMarkers({
    mapRef: mapInstance,
    routesRef,
    routeMarkerMapRef,
    routeMarkerClusterRef,
    routeMarkerClusterGenerationRef,
    routesSyncSigRef,
    selectedRouteIdRef,
    markerVisibilityTimerRef,
    getTmapv3: getTmapv3Runtime,
    tryReadMarkerAttachedMap,
    tryReadSdkLatLngFromMarker,
    roundCoordForLog,
    isMarkerCoordDebugEnabled,
    isMarkerLifecycleDebugEnabled,
    bottomSheetVisibleHeightRef,
    onCourseMarkerClick,
    setMarkerHoverCursor,
    syncSelectedRoutePolyline,
    clearSelectedRoutePolyline,
  });

  const registerMapListeners = useCallback(
    (map: TmapMap) => {
      if (mapListenersRegisteredRef.current) return;

      // 일부 Tmap SDK 런타임은 on/addListener 중 하나만 제공하므로 둘 다 대응한다.
      const hasMapEventBinder =
        typeof map.on === 'function' || typeof map.addListener === 'function';
      if (!hasMapEventBinder) return;

      const handleStartInteraction = () => {
        isMapInteractingRef.current = true;

        // 종료 이벤트가 누락되는 환경에서도 마커가 영구히 숨겨지지 않도록 워치독으로 강제 해제한다.
        if (interactionWatchdogTimerRef.current !== null) {
          window.clearTimeout(interactionWatchdogTimerRef.current);
        }
        interactionWatchdogTimerRef.current = window.setTimeout(() => {
          interactionWatchdogTimerRef.current = null;
          isMapInteractingRef.current = false;
          syncRouteMarkersDisplayForZoomByHook(map);
          scheduleMarkerVisibilitySyncByHook(map);
          scheduleViewportReport(map);
        }, 1600);
      };

      const handleEndInteraction = () => {
        isMapInteractingRef.current = false;

        if (interactionWatchdogTimerRef.current !== null) {
          window.clearTimeout(interactionWatchdogTimerRef.current);
          interactionWatchdogTimerRef.current = null;
        }
      };

      const handleZoomChanged = () => {
        const currentZoom = enforceMinZoomLevel(map);
        if (currentZoom === null) return;
        notifyZoomLimitState(currentZoom);

        if (currentZoom === lastAppliedZoomRef.current) {
          syncRouteMarkersDisplayForZoomByHook(map);
          scheduleMarkerVisibilitySyncByHook(map);
          scheduleViewportReport(map);
          return;
        }
        lastAppliedZoomRef.current = currentZoom;
        if (zoomUpdateRafRef.current !== null) return;
        zoomUpdateRafRef.current = window.requestAnimationFrame(() => {
          zoomUpdateRafRef.current = null;
          const currentLocation = currentLocationCoordinateRef.current;
          if (currentLocation) {
            createCurrentLocationMarker(map, currentLocation.lat, currentLocation.lng);
          }
          syncRouteMarkersDisplayForZoomByHook(map);
          scheduleMarkerVisibilitySyncByHook(map);
          scheduleViewportReport(map);
        });
      };

      // 런타임별로 zoom 종료 이벤트가 다르게 동작할 수 있어 변경/종료 계열을 함께 구독한다.
      const boundZoomEvents = bindMapEvents(
        map,
        ['zoom', 'zoom_changed', 'zoom_end', 'zoomend', 'idle'],
        handleZoomChanged,
      );

      const reportAfterMove = () => {
        syncRouteMarkersDisplayForZoomByHook(map);
        scheduleMarkerVisibilitySyncByHook(map);
        scheduleViewportReport(map);
        onDragSettled?.();
      };

      const boundMoveEvents = bindMapEvents(
        map,
        ['dragend', 'dragEnd', 'moveend', 'panend'],
        reportAfterMove,
      );

      // 상호작용(이동/줌) 중 마커 visibility 토글이 깜빡임을 유발할 수 있어 플래그로 제어한다.
      const boundStartInteractionEvents = bindMapEvents(
        map,
        ['drag', 'bounds_changed', 'center_changed', 'zoom', 'zoom_changed'],
        handleStartInteraction,
      );
      const boundEndInteractionEvents = bindMapEvents(
        map,
        ['dragend', 'dragEnd', 'moveend', 'panend', 'zoom_end', 'zoomend', 'idle'],
        handleEndInteraction,
      );

      mapListenersRegisteredRef.current =
        boundZoomEvents ||
        boundMoveEvents ||
        boundStartInteractionEvents ||
        boundEndInteractionEvents;
    },
    [
      createCurrentLocationMarker,
      currentLocationCoordinateRef,
      enforceMinZoomLevel,
      isMapInteractingRef,
      notifyZoomLimitState,
      onDragSettled,
      scheduleMarkerVisibilitySyncByHook,
      scheduleViewportReport,
      syncRouteMarkersDisplayForZoomByHook,
    ],
  );

  const applyInitialViewport = useCallback(
    (map: TmapMap) => {
      const viewport = initialViewport;
      const Tmapv3 = getTmapv3Runtime();
      if (!viewport || !Tmapv3) return;
      if (typeof map.fitBounds !== 'function') return;

      const southWest = new Tmapv3.LatLng(viewport.southWestLat, viewport.southWestLng);
      const northEast = new Tmapv3.LatLng(viewport.northEastLat, viewport.northEastLng);
      const LatLngBounds = (
        Tmapv3 as unknown as { LatLngBounds?: new (sw: unknown, ne: unknown) => unknown }
      ).LatLngBounds;

      if (typeof LatLngBounds === 'function') {
        const bounds = new LatLngBounds(southWest, northEast);
        map.fitBounds(bounds, 0);
      } else {
        map.fitBounds(southWest, northEast);
      }
      clampHomeMapZoom(map);
    },
    [initialViewport],
  );

  const { mapReadyToken, handleRefreshLocation } = useHomeMapLifecycle({
    mapContainerId: 'map_div',
    initialViewport,
    routesRef,
    mapRef: mapInstance,
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
    getTmapv3: getTmapv3Runtime,
    minZoomLevel: MIN_ZOOM_LEVEL,
    maxZoomLevel: MAX_ZOOM_LEVEL,
    createCurrentLocationMarker,
    centerMapToLocationInVisibleArea,
    applyInitialViewport,
    enforceMinZoomLevel,
    registerMapListeners,
    scheduleViewportReport,
    scheduleMarkerVisibilitySync: scheduleMarkerVisibilitySyncByHook,
    emitViewportReports,
    syncRouteMarkers: syncRouteMarkersByHook,
    isViewportReportSuppressed,
  });

  // Tmap JS는 마우스 팬 시 drag/bounds_changed가 안 오는 경우가 있어, map_div 포인터로 상호작용 여부를 잡는다.
  useEffect(() => {
    if (mapReadyToken === 0) return undefined;
    const el = document.getElementById('map_div');
    if (!el) return undefined;

    let activePointerId: number | null = null;

    const endTracking = (event: PointerEvent) => {
      if (activePointerId === null || event.pointerId !== activePointerId) return;
      activePointerId = null;
      try {
        el.releasePointerCapture(event.pointerId);
      } catch {
        /* noop */
      }
      isPrimaryPointerDownOnMapRef.current = false;
      const map = mapInstance.current;
      if (!map) return;
      syncRouteMarkersDisplayForZoomByHook(map);
      scheduleMarkerVisibilitySyncByHook(map);
      scheduleViewportReport(map);
      onDragSettled?.();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      activePointerId = event.pointerId;
      isPrimaryPointerDownOnMapRef.current = true;
      try {
        el.setPointerCapture(event.pointerId);
      } catch {
        /* noop */
      }
    };

    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', endTracking, true);
    window.addEventListener('pointercancel', endTracking, true);

    return () => {
      isPrimaryPointerDownOnMapRef.current = false;
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', endTracking, true);
      window.removeEventListener('pointercancel', endTracking, true);
    };
  }, [
    mapReadyToken,
    onDragSettled,
    scheduleMarkerVisibilitySyncByHook,
    scheduleViewportReport,
    syncRouteMarkersDisplayForZoomByHook,
  ]);

  useEffect(() => {
    routesRef.current = routes;
  }, [routes]);

  useEffect(() => {
    if (!selectedCourseId) {
      selectedRouteDataReadyRef.current = false;
      return;
    }

    const isSelectedRouteReady = routes.some((route) => route.id === selectedCourseId);
    if (!isSelectedRouteReady) return;
    if (selectedRouteDataReadyRef.current) return;
    selectedRouteDataReadyRef.current = true;

    // 뒤로 복귀 시 선택 코스 데이터가 늦게 들어와도 폴리라인 동기화를 1회 보장한다.
    const shouldFocusSelectedCourse = markerClickRecenterToken > 0;
    syncSelectedMarkerVisualByHook(selectedCourseId, shouldFocusSelectedCourse);
  }, [markerClickRecenterToken, routes, selectedCourseId, syncSelectedMarkerVisualByHook]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    const sig = buildRoutesSyncSignature(routes);
    if (routesSyncSigRef.current === sig) {
      if (isMarkerLifecycleDebugEnabled()) {
        /* eslint-disable no-console -- lifecycle */
        console.info(
          '[TmapHome:lifecycle] routes prop effect — syncRouteMarkers 생략(데이터 서명 동일)',
          { count: routes.length },
        );
        /* eslint-enable no-console */
      }
      return;
    }

    if (isMarkerLifecycleDebugEnabled()) {
      /* eslint-disable no-console -- lifecycle */
      console.info('[TmapHome:lifecycle] routes prop effect — syncRouteMarkers 실행', {
        prevSig: routesSyncSigRef.current?.slice(0, 80),
        nextSig: sig.slice(0, 80),
      });
      /* eslint-enable no-console */
    }

    syncRouteMarkersByHook(map, routes);
    scheduleMarkerVisibilitySyncByHook(map);
  }, [routes, scheduleMarkerVisibilitySyncByHook, syncRouteMarkersByHook]);

  useEffect(() => {
    // [동기화] 외부 선택 상태(selectedCourseId)와 마커 clicked 상태 정합성 유지
    // 뒤로 복귀 직후에는 지도/코스 데이터 준비 타이밍이 엇갈릴 수 있어 재시도 트리거를 넓힌다.
    selectedRouteDataReadyRef.current = false;
    const shouldFocusSelectedCourse = Boolean(selectedCourseId) && markerClickRecenterToken > 0;
    syncSelectedMarkerVisualByHook(selectedCourseId, shouldFocusSelectedCourse);
    const map = mapInstance.current;
    if (map) {
      scheduleMarkerVisibilitySyncByHook(map);
    }
  }, [
    mapReadyToken,
    markerClickRecenterToken,
    selectedCourseId,
    scheduleMarkerVisibilitySyncByHook,
    syncSelectedMarkerVisualByHook,
  ]);

  // 바텀시트 높이 변경 시: 가시 viewport만 갱신(마커/클러스터 생명주기는 건드리지 않음)
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return undefined;

    if (isMarkerLifecycleDebugEnabled()) {
      /* eslint-disable no-console -- lifecycle */
      console.info('[TmapHome:lifecycle] bottomSheetVisibleHeight effect · visible viewport만', {
        sheetPx: bottomSheetVisibleHeight,
      });
      /* eslint-enable no-console */
    }

    const frameId = requestAnimationFrame(() => {
      const liveMap = mapInstance.current;
      if (!liveMap) return;
      emitVisibleViewportReportOnly(liveMap);
    });
    return () => cancelAnimationFrame(frameId);
  }, [bottomSheetVisibleHeight, emitVisibleViewportReportOnly]);

  useEffect(() => {
    return () => {
      clearViewportReporterState();
      if (viewportSyncIntervalRef.current !== null) {
        window.clearInterval(viewportSyncIntervalRef.current);
        viewportSyncIntervalRef.current = null;
      }
    };
  }, [clearViewportReporterState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 1024px)');
    const syncViewportType = () => {
      setIsMobileOrTabletViewport(mediaQuery.matches);
    };

    syncViewportType();
    mediaQuery.addEventListener('change', syncViewportType);
    return () => {
      mediaQuery.removeEventListener('change', syncViewportType);
    };
  }, []);

  useEffect(() => {
    const rootElement = rootRef.current;
    if (!rootElement) return;

    const wheelListener = (event: WheelEvent) => {
      handleMapWheel(event);
    };

    rootElement.addEventListener('wheel', wheelListener, { passive: false });
    return () => {
      rootElement.removeEventListener('wheel', wheelListener);
    };
  }, [handleMapWheel]);

  // 지도 div 크기는 바텀시트(오버레이)와 무관하게 mapStage 전체를 쓴다.
  // 바텀시트 높이 변화마다 resize()를 호출하면(드래그 중 매 프레임 포함) 티맵 마커/클러스터 레이어가 사라지는 현상이 난다.
  // 실제 컨테이너 가로·세로가 바뀐 경우에만 resize + 보이는 뷰포트 재보고
  useEffect(() => {
    const handleViewportResize = () => {
      const mapEl = document.getElementById('map_div');
      const map = mapInstance.current;
      if (!mapEl || !map) return;
      const width = mapEl.clientWidth;
      const height = mapEl.clientHeight;
      const prev = lastMapContainerSizeRef.current;
      if (prev.width === width && prev.height === height) {
        return;
      }
      lastMapContainerSizeRef.current = { width, height };
      if (isMarkerLifecycleDebugEnabled()) {
        /* eslint-disable no-console -- lifecycle */
        console.info(
          '[TmapHome:lifecycle] map.resize + emitViewportReports (컨테이너 크기 실제 변경)',
          {
            width,
            height,
          },
        );
        /* eslint-enable no-console */
      }
      map.resize?.();
      emitViewportReports(map);
      routeMarkerClusterGenerationRef.current += 1;
      syncRouteMarkersDisplayForZoomByHook(map);
    };

    window.addEventListener('resize', handleViewportResize);
    window.visualViewport?.addEventListener('resize', handleViewportResize);
    return () => {
      window.removeEventListener('resize', handleViewportResize);
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, [emitViewportReports, syncRouteMarkersDisplayForZoomByHook]);

  const sheetControlPositionClassName =
    sheetChromeBottomHeight <= 24 ? styles.sheetControlsCollapsed : styles.sheetControlsPeek;
  const shouldHideFloatingControls =
    isBottomSheetExpanded || (isMobileOrTabletViewport && sheetChromeBottomHeight >= 320);

  return (
    <div ref={rootRef} className={styles.root}>
      <div id="map_div" className={styles.map} />
      <button
        type="button"
        className={`${styles.refreshButton} ${sheetControlPositionClassName} ${shouldHideFloatingControls ? styles.refreshButtonHidden : ''}`}
        onClick={handleRefreshLocation}
      >
        <Icon name="locateFixed" size={24} className={styles.refreshIcon} />
      </button>
      <div
        className={`${styles.zoomButtonGroup} ${sheetControlPositionClassName} ${shouldHideFloatingControls ? styles.refreshButtonHidden : ''}`}
      >
        <button type="button" className={styles.zoomButton} onClick={() => adjustZoomLevel(1)}>
          <Icon name="plus" size={20} className={styles.zoomButtonIcon} />
        </button>
        <button type="button" className={styles.zoomButton} onClick={() => adjustZoomLevel(-1)}>
          <Icon name="minus" size={20} className={styles.zoomButtonIcon} />
        </button>
      </div>
    </div>
  );
}

export default TmapHome;
