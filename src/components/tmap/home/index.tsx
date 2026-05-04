'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Icon } from '@/commons/components/icons';
import type { Route, RouteViewport } from '@/commons/types/runroute';
import { SEOUL_CITY_HALL_COORDINATE } from '@/commons/utils/geo';
import { resolveRouteStartForMapMarker } from '@/commons/utils/route-marker-position';
import { getDistanceCategory, type DistanceCategory } from '@/components/home/utils/course-filter';
import {
  dedupeConsecutiveCoordinates,
  extractPathCoordinates,
  extractSavedRoutePoints,
} from '@/components/tmap/course-detail/path-data';
import { applyPointerCursorToTmapMarker } from '@/components/tmap/utils/apply-pointer-cursor-to-tmap-marker';
import { getPedestrianRoute } from '@/repositories/map.repository';

import {
  getRunningCourseMarkerIconUrlForCategory,
  type MarkerVisualState,
} from './build-running-course-marker-icon';
import styles from './styles.module.css';
import { computeVisibleRouteViewportFromMapCanvas } from './visible-map-viewport';

/** 줌 시 마커 위경도 디버그 로그. 끄기: `localStorage.DEBUG_TMAP_MARKERS=0` · 항상 켜기: `=1` */
function isMarkerCoordDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const flag = window.localStorage?.getItem('DEBUG_TMAP_MARKERS');
  if (flag === '0') return false;
  if (flag === '1') return true;
  return process.env.NODE_ENV === 'development';
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

function isSameRouteViewport(left: RouteViewport | null, right: RouteViewport | null): boolean {
  if (!left || !right) return false;
  return (
    left.northEastLat === right.northEastLat &&
    left.northEastLng === right.northEastLng &&
    left.southWestLat === right.southWestLat &&
    left.southWestLng === right.southWestLng
  );
}

/** 티맵 공식 예제: `new Tmapv3.extension.MarkerCluster({ markers, map })` */
type TmapMarkerCluster = {
  setMap?: (map: TmapMap | null) => void;
  /** 일부 SDK에서 클러스터가 가진 마커 참조를 먼저 비울 때 사용 */
  clearMarkers?: () => void;
};

type TmapV3API = {
  Map: new (id: string, options: Record<string, unknown>) => TmapMap;
  LatLng: new (lat: number, lng: number) => TmapLatLng;
  Size: new (width: number, height: number) => unknown;
  Point?: new (x: number, y: number) => unknown;
  Marker: new (options: Record<string, unknown>) => TmapMarker;
  Polyline: new (options: Record<string, unknown>) => TmapPolyline;
  extension?: {
    MarkerCluster: new (options: { markers: TmapMarker[]; map: TmapMap }) => TmapMarkerCluster;
  };
  event?: {
    addListener?: (target: TmapMarker, eventName: string, callback: () => void) => void;
  };
  Event?: {
    addListener?: (target: TmapMarker, eventName: string, callback: () => void) => void;
  };
};

// [유틸] 전역 Tmapv3 객체 접근 래퍼
function getTmapv3(): TmapV3API | undefined {
  const globalWindow = window as unknown as {
    Tmapv3?: TmapV3API;
  };
  return globalWindow.Tmapv3;
}

/** MarkerCluster 확장이 있으면 코스 마커는 map 옵션 없이 생성하고 클러스터러만 부착한다(이중 렌더·유령 클러스터 방지). */
function isTmapRouteMarkerClusterLoaded(): boolean {
  return typeof getTmapv3()?.extension?.MarkerCluster === 'function';
}

type TmapLatLng = {
  lat?: (() => number) | number;
  lng?: (() => number) | number;
  _lat?: number;
  _lng?: number;
  latValue?: number;
  lngValue?: number;
};

type TmapMarker = {
  setMap: (map: TmapMap | null) => void;
  setPosition: (position: TmapLatLng) => void;
  getMap?: () => TmapMap | null;
  map?: TmapMap | null;
  setIcon?: (icon: string) => void;
  addListener?: (eventName: string, callback: () => void) => void;
  on?: (eventName: string, callback: () => void) => void;
  getElement?: () => HTMLElement | null;
  /** 일부 Tmap SDK 버전에서 마커 인스턴스의 현재 위경도 조회용 */
  getPosition?: () => TmapLatLng;
};

type TmapPolyline = {
  setMap: (map: TmapMap | null) => void;
  getPath?: () => TmapLatLng[];
};

type TmapMap = {
  setCenter: (center: TmapLatLng) => void;
  setZoom: (zoomLevel: number, options?: Record<string, unknown>) => void;
  getZoom: () => number;
  setZoomLimit?: (minZoom: number, maxZoom: number) => void;
  getMinZoom?: () => number;
  getMaxZoom?: () => number;
  zoomIn?: () => void;
  zoomOut?: () => void;
  addListener?: (eventName: string, callback: () => void) => void;
  on?: (eventName: string, callback: () => void) => void;
  resize?: () => void;
  getBounds?: () => TmapLatLngBoundsLike | null | undefined;
  /** 코스 경로 맞춤 — `LatLngBounds`+패딩 또는 `southWest`·`northEast` 쌍(상세 지도와 동일) */
  fitBounds?: (...args: unknown[]) => void;
};

type TmapLatLngBoundsLike = {
  getNorthEast?: () => TmapLatLng;
  getSouthWest?: () => TmapLatLng;
};

type TmapHomeProps = {
  bottomSheetVisibleHeight?: number;
  isBottomSheetExpanded?: boolean;
  routes?: Route[];
  selectedCourseId?: string | null;
  /** 마커 클릭 시마다 증가 — 보이는 지도 영역 기준 1회 중앙 정렬에만 사용 */
  markerClickRecenterToken?: number;
  onCourseMarkerClick?: (courseId: string) => void;
  /** 데이터 필터용 — 전체 지도 bounds(getBounds), 바텀시트 오버레이 미반영 */
  onViewportChanged?: (viewport: RouteViewport) => void;
  /** UI용 — 바텀시트가 가리지 않는 영역 근사 bounds */
  onVisibleViewportChanged?: (viewport: RouteViewport | null) => void;
};

type RouteMarkerEntry = {
  marker: TmapMarker;
  category: DistanceCategory;
  visualState: MarkerVisualState;
  lat: number;
  lng: number;
  isVisible: boolean;
  outOfViewportSinceMs: number | null;
};

const DEFAULT_GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 6000,
  maximumAge: 15000,
};

const PRECISE_GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

const MIN_ZOOM_LEVEL = 11;
const MAX_ZOOM_LEVEL = 19;

/**
 * 코스 마커: 클러스터 모드(줌 이하·멀리) ↔ 개별 마커 모드(줌 이상·가까이).
 * 두 상수는 연속된 정수여야 함(예: 14 이하 클러스터, 15 이상 개별).
 */
const ROUTE_MARKER_CLUSTER_ZOOM_AT_OR_BELOW = 14;
const ROUTE_MARKER_INDIVIDUAL_ZOOM_AT_OR_ABOVE = ROUTE_MARKER_CLUSTER_ZOOM_AT_OR_BELOW + 1;

/** 홈 지도 최초 표시 줌. 값이 작을수록 현재 위치 주변이 더 넓게(줌 아웃) 보임 */
const INITIAL_MAP_ZOOM_LEVEL = 14;
const MARKER_VISIBILITY_DEBOUNCE_MS = 140;

/** 홈 선택 코스 fitBounds — 상세(72px)보다 크게 두어 동네 맥락이 보이게 함 */
const ROUTE_POLYLINE_FIT_BOUNDS_PADDING_PX = 196;

/** 경로 bbox를 중심 기준으로 키움. 짧은 코스가 화면을 가득 채우며 과확대되는 것을 줄임 */
const ROUTE_BOUNDS_INFLATE_RATIO = 1.42;

/** 아주 짧은 경로에도 적용할 최소 바운딩 크기(도) — 대략 수백 m~1km대 컨텍스트 */
const ROUTE_BOUNDS_MIN_SPAN_LAT = 0.0088;
const ROUTE_BOUNDS_MIN_SPAN_LNG = 0.0112;

/** fitBounds 직후 허용하는 최대 줌(값이 클수록 확대). 두 번째 스크린샷 정도의 배율을 목표로 15 고정 */
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

function clampHomeMapZoom(map: TmapMap): void {
  const currentZoom = map.getZoom?.();
  if (typeof currentZoom !== 'number') return;
  const clamped = Math.min(MAX_ZOOM_LEVEL, Math.max(MIN_ZOOM_LEVEL, currentZoom));
  if (clamped !== currentZoom) {
    map.setZoom(clamped);
  }
}

function clampRoutePolylineFitZoom(map: TmapMap): void {
  const z = map.getZoom?.();
  if (typeof z !== 'number') return;
  if (z > ROUTE_POLYLINE_FIT_MAX_ZOOM_LEVEL) {
    map.setZoom(ROUTE_POLYLINE_FIT_MAX_ZOOM_LEVEL);
  }
}

function toSvgDataUrl(svgMarkup: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarkup)}`;
}

function getCurrentLocationIndicatorSizeByZoom(_zoomLevel: number | undefined): number {
  return 40;
}

function getCurrentLocationIndicatorIconUrl(size: number): string {
  // 기본 A 마커 대신, 파란 점 + 반투명 링 형태의 현재 위치 인디케이터를 사용한다.
  const center = size / 2;
  const outerRingRadius = Math.round(size * 0.42);
  const innerWhiteRadius = Math.round(size * 0.23);
  const dotRadius = Math.round(size * 0.17);
  const coreRadius = Math.round(size * 0.13);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${center}" cy="${center}" r="${outerRingRadius}" fill="#2F80FF" opacity="0.16"/>
  <circle cx="${center}" cy="${center}" r="${innerWhiteRadius}" fill="#FFFFFF" opacity="0.98"/>
  <circle cx="${center}" cy="${center}" r="${dotRadius}" fill="#2F80FF"/>
  <circle cx="${center}" cy="${center}" r="${coreRadius}" fill="#2F80FF"/>
</svg>
`.trim();
  return toSvgDataUrl(svg);
}

export function TmapHome({
  bottomSheetVisibleHeight = 24,
  isBottomSheetExpanded = false,
  routes = [],
  selectedCourseId = null,
  markerClickRecenterToken = 0,
  onCourseMarkerClick,
  onViewportChanged,
  onVisibleViewportChanged,
}: TmapHomeProps) {
  const [isMobileOrTabletViewport, setIsMobileOrTabletViewport] = useState(false);
  // [상태] 지도/마커 인스턴스 참조 관리
  const mapInstance = useRef<TmapMap | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const currentLocationMarkerRef = useRef<TmapMarker | null>(null);
  const currentLocationCoordinateRef = useRef<{ lat: number; lng: number } | null>(null);
  const selectedRoutePolylineRef = useRef<TmapPolyline | null>(null);
  /** 선택 코스 폴리라인 요청 무효화(연속 클릭·선택 해제) */
  const routePolylineGenerationRef = useRef(0);
  const routePolylineAbortRef = useRef<AbortController | null>(null);
  const routeMarkerMapRef = useRef<Map<string, RouteMarkerEntry>>(new Map());
  const routeMarkerClusterRef = useRef<TmapMarkerCluster | null>(null);
  /** 확장 로더 유무와 무관하게, 마지막으로 적용한 코스 마커 표시 방식 */
  const routeMarkerRouteDisplayModeRef = useRef<'cluster' | 'individual'>('individual');
  /** 코스 마커 인스턴스 집합이 바뀔 때마다 증가 → 클러스터 재부착 필요 */
  const routeMarkerClusterGenerationRef = useRef(0);
  /** 마지막으로 MarkerCluster에 붙인 generation */
  const routeMarkerClusterAttachGenerationRef = useRef(-1);
  const routesRef = useRef<Route[]>(routes);
  /** syncRouteMarkers 가 실제 데이터 변경 시에만 돌도록 마지막 동기화 서명 */
  const routesSyncSigRef = useRef<string | null>(null);
  const selectedRouteIdRef = useRef<string | null>(null);
  const viewportReportTimerRef = useRef<number | null>(null);
  const viewportSyncIntervalRef = useRef<number | null>(null);
  const mapListenersRegisteredRef = useRef(false);
  const wheelZoomThrottleTimerRef = useRef<number | null>(null);
  const zoomUpdateRafRef = useRef<number | null>(null);
  const markerVisibilityTimerRef = useRef<number | null>(null);
  const isMapInteractingRef = useRef(false);
  const interactionWatchdogTimerRef = useRef<number | null>(null);
  const lastAppliedZoomRef = useRef<number | null>(null);
  const lastQueryViewportRef = useRef<RouteViewport | null>(null);
  const lastVisibleViewportReportRef = useRef<RouteViewport | null>(null);
  /** 클러스터 재구성 — 바텀 오버레이/선택 상태 변화 추적 */
  const routeMarkerOverlaySignatureRef = useRef('');
  const routeVisualStateHandlerRef = useRef<(courseId: string, state: MarkerVisualState) => void>(
    () => undefined,
  );
  const selectedMarkerVisualHandlerRef = useRef<(courseId: string | null) => void>(() => undefined);
  const markerHoverCountRef = useRef(0);
  const bottomSheetVisibleHeightRef = useRef(bottomSheetVisibleHeight);
  bottomSheetVisibleHeightRef.current = bottomSheetVisibleHeight;
  const lastMarkerRecenterSignatureRef = useRef<string>('');
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

  const logMarkerCoordinateAudit = useCallback(
    (map: TmapMap, phase: string) => {
      if (!isMarkerCoordDebugEnabled()) return;
      const zoom = typeof map.getZoom === 'function' ? map.getZoom() : Number.NaN;
      const selectedId = selectedRouteIdRef.current;
      const rows: Array<Record<string, string | number | boolean | null>> = [];
      let mismatch = 0;
      let noSdkReader = 0;

      routeMarkerMapRef.current.forEach((entry, routeId) => {
        const sdk = tryReadSdkLatLngFromMarker(entry.marker);
        if (!sdk) noSdkReader += 1;
        const dLat = sdk ? sdk.lat - entry.lat : null;
        const dLng = sdk ? sdk.lng - entry.lng : null;
        const coordsOk =
          sdk !== null &&
          dLat !== null &&
          dLng !== null &&
          Math.abs(dLat) < 1e-9 &&
          Math.abs(dLng) < 1e-9;
        if (!coordsOk) mismatch += 1;
        rows.push({
          routeId: `${routeId.slice(0, 10)}…`,
          sel: routeId === selectedId,
          visible: entry.isVisible,
          storedLat: roundCoordForLog(entry.lat),
          storedLng: roundCoordForLog(entry.lng),
          sdkLat: sdk ? roundCoordForLog(sdk.lat) : null,
          sdkLng: sdk ? roundCoordForLog(sdk.lng) : null,
          dLat: dLat !== null ? roundCoordForLog(dLat) : null,
          dLng: dLng !== null ? roundCoordForLog(dLng) : null,
        });
      });

      /* eslint-disable no-console -- DEBUG_TMAP_MARKERS / 개발 모드 마커 좌표 불변 검사 */
      console.groupCollapsed(
        `[TmapHome] marker-debug · ${phase} · zoom=${String(zoom)} · mismatch=${mismatch}/${rows.length} · noGetPosition=${noSdkReader}`,
      );
      console.table(rows);
      console.log(
        '해석: stored* = 앱이 route에 넣은 값, sdk* = Marker.getPosition() (없으면 null). d가 0이면 위경도 숫자는 안 바뀐 것. 여전히 화면에서 밀리면 앵커/투영/CSS 이슈.',
      );
      console.groupEnd();
      /* eslint-enable no-console */
    },
    [tryReadSdkLatLngFromMarker],
  );

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

  /** useRoutes·쿼리용 — 바텀 오버레이와 무관하게 전체 지도 bounds */
  const computeQueryViewportFromMap = useCallback(
    (map: TmapMap): RouteViewport | null => readMapBoundsViewport(map),
    [readMapBoundsViewport],
  );

  /** 목록·마커 오버레이용 — 바텀시트가 가리는 높이 반영 */
  const computeVisibleViewportFromMap = useCallback(
    (map: TmapMap): RouteViewport | null => {
      const base = readMapBoundsViewport(map);
      if (!base) return null;

      const mapElement = document.getElementById('map_div');
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
    [readMapBoundsViewport],
  );

  const emitViewportReports = useCallback(
    (map: TmapMap) => {
      let queryEmitted = false;
      let visibleEmitted = false;

      const queryVp = computeQueryViewportFromMap(map);
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

      if (isMarkerLifecycleDebugEnabled() && (queryEmitted || visibleEmitted)) {
        /* eslint-disable no-console -- lifecycle */
        console.info('[TmapHome:lifecycle] emitViewportReports', {
          queryEmitted,
          visibleEmitted,
          resizeAvailable: typeof map.resize === 'function',
        });
        /* eslint-enable no-console */
      }
    },
    [
      computeQueryViewportFromMap,
      computeVisibleViewportFromMap,
      onViewportChanged,
      onVisibleViewportChanged,
    ],
  );

  /** 바텀시트 높이만 바뀔 때 — 부모의 데이터용 queryViewport는 건드리지 않음 */
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

  const logRouteMarkerAttachSnapshot = (map: TmapMap | null, phase: string) => {
    if (!isMarkerLifecycleDebugEnabled()) return;
    const targetMap = map ?? mapInstance.current;
    let routeMarkersAttachedToMap = 0;
    const sample: Record<string, unknown>[] = [];
    routeMarkerMapRef.current.forEach((entry, routeId) => {
      const sdkMap = tryReadMarkerAttachedMap(entry.marker);
      const markerOnTarget = sdkMap != null && sdkMap === targetMap;
      if (markerOnTarget) routeMarkersAttachedToMap += 1;

      let iconProbe: boolean | string = 'no-element';
      const el = entry.marker.getElement?.();
      if (el instanceof HTMLElement) {
        const img = el.querySelector('img');
        if (img) {
          iconProbe = img.complete && img.naturalHeight > 0;
        } else {
          iconProbe = 'no-img';
        }
      }

      if (sample.length < 8) {
        sample.push({
          id: `${routeId.slice(0, 10)}…`,
          entryVisible: entry.isVisible,
          markerOnTargetMap: markerOnTarget,
          getMapOrMap: sdkMap != null,
          iconOk: iconProbe,
        });
      }
    });

    const cluster = routeMarkerClusterRef.current as unknown as {
      getMarkers?: () => unknown[];
      markers?: unknown[];
    } | null;
    let clusterMarkerCount: number | null = null;
    if (cluster && typeof cluster.getMarkers === 'function') {
      try {
        clusterMarkerCount = cluster.getMarkers()?.length ?? null;
      } catch {
        clusterMarkerCount = null;
      }
    } else if (cluster && Array.isArray(cluster.markers)) {
      clusterMarkerCount = cluster.markers.length;
    }

    /* eslint-disable no-console -- DEBUG_TMAP_MARKER_LIFECYCLE */
    console.groupCollapsed(`[TmapHome:lifecycle] SDK 부착 스냅샷 · ${phase}`);
    console.log({
      targetMapExists: !!targetMap,
      mapMarkerEntryCount: routeMarkerMapRef.current.size,
      routeMarkersAttachedToTargetMap: routeMarkersAttachedToMap,
      clusterRefExists: !!routeMarkerClusterRef.current,
      clusterMarkerCountProbe: clusterMarkerCount,
      bottomSheetPx: bottomSheetVisibleHeightRef.current,
      zoom: targetMap && typeof targetMap.getZoom === 'function' ? targetMap.getZoom() : null,
      sampleRows: sample,
    });
    console.groupEnd();
    /* eslint-enable no-console */
  };

  const tearDownRouteMarkerCluster = useCallback(() => {
    const cluster = routeMarkerClusterRef.current;
    if (!cluster) {
      if (isMarkerLifecycleDebugEnabled()) {
        /* eslint-disable no-console -- lifecycle */
        console.info('[TmapHome:lifecycle] tearDownRouteMarkerCluster · noop (cluster ref 없음)');
        /* eslint-enable no-console */
      }
      return;
    }

    const clusterLoose = cluster as unknown as {
      clearMarkers?: () => void;
      setMap?: (m: unknown) => void;
      removeMarkers?: () => void;
      getMarkers?: () => unknown[];
      markers?: unknown[];
    };

    if (isMarkerLifecycleDebugEnabled()) {
      let beforeCount: number | null = null;
      if (typeof clusterLoose.getMarkers === 'function') {
        try {
          beforeCount = clusterLoose.getMarkers()?.length ?? null;
        } catch {
          beforeCount = null;
        }
      } else if (Array.isArray(clusterLoose.markers)) {
        beforeCount = clusterLoose.markers.length;
      }
      /* eslint-disable no-console -- lifecycle */
      console.groupCollapsed('[TmapHome:lifecycle] tearDownRouteMarkerCluster 실행');
      console.log({
        clusterMarkerCountBefore: beforeCount,
        hasClearMarkers: typeof clusterLoose.clearMarkers === 'function',
        hasRemoveMarkers: typeof clusterLoose.removeMarkers === 'function',
      });
      console.trace();
      console.groupEnd();
      /* eslint-enable no-console */
    }

    if (typeof clusterLoose.clearMarkers === 'function') {
      try {
        clusterLoose.clearMarkers();
      } catch (e) {
        if (isMarkerLifecycleDebugEnabled()) {
          /* eslint-disable no-console -- lifecycle */
          console.warn('[TmapHome:lifecycle] cluster.clearMarkers 예외', e);
          /* eslint-enable no-console */
        }
      }
    }

    if (typeof clusterLoose.removeMarkers === 'function') {
      try {
        clusterLoose.removeMarkers();
        if (isMarkerLifecycleDebugEnabled()) {
          /* eslint-disable no-console -- lifecycle */
          console.info('[TmapHome:lifecycle] cluster.removeMarkers() 호출됨');
          /* eslint-enable no-console */
        }
      } catch (e) {
        if (isMarkerLifecycleDebugEnabled()) {
          /* eslint-disable no-console -- lifecycle */
          console.warn('[TmapHome:lifecycle] cluster.removeMarkers 예외', e);
          /* eslint-enable no-console */
        }
      }
    }

    cluster.setMap?.(null);
    routeMarkerClusterRef.current = null;
  }, []);

  /**
   * 줌 레벨만으로 클러스터 ↔ 개별 마커 전환.
   * 바텀시트·오버레이와 무관 — 지도 코스 마커는 시트 클릭으로 숨기지 않음(목록 가시 viewport는 별도 콜백).
   */
  const syncRouteMarkersDisplayForZoom = useCallback(
    (map: TmapMap) => {
      const markerCount = routeMarkerMapRef.current.size;

      if (!isTmapRouteMarkerClusterLoaded()) {
        tearDownRouteMarkerCluster();
        routeMarkerRouteDisplayModeRef.current = 'individual';
        routeMarkerClusterAttachGenerationRef.current = -1;
        routeMarkerOverlaySignatureRef.current = '';
        routeMarkerMapRef.current.forEach((entry) => {
          entry.marker.setMap(map);
          entry.isVisible = true;
          entry.outOfViewportSinceMs = null;
        });
        return;
      }

      const rawZoom = map.getZoom();
      if (typeof rawZoom !== 'number' || Number.isNaN(rawZoom)) {
        routeMarkerMapRef.current.forEach((entry) => {
          entry.marker.setMap(map);
          entry.isVisible = true;
        });
        return;
      }

      if (markerCount === 0) {
        tearDownRouteMarkerCluster();
        routeMarkerRouteDisplayModeRef.current = 'individual';
        routeMarkerClusterAttachGenerationRef.current = -1;
        routeMarkerOverlaySignatureRef.current = '';
        return;
      }

      const wantClusterMode = rawZoom <= ROUTE_MARKER_CLUSTER_ZOOM_AT_OR_BELOW;
      const wantIndividualMode = rawZoom >= ROUTE_MARKER_INDIVIDUAL_ZOOM_AT_OR_ABOVE;

      if (wantIndividualMode) {
        tearDownRouteMarkerCluster();
        routeMarkerRouteDisplayModeRef.current = 'individual';
        routeMarkerClusterAttachGenerationRef.current = -1;
        routeMarkerOverlaySignatureRef.current = '';
        routeMarkerMapRef.current.forEach((entry) => {
          entry.marker.setMap(map);
          entry.isVisible = true;
          entry.outOfViewportSinceMs = null;
        });
        return;
      }

      if (wantClusterMode) {
        const gen = routeMarkerClusterGenerationRef.current;
        const prevMode = routeMarkerRouteDisplayModeRef.current;
        const needsRebuild =
          prevMode !== 'cluster' ||
          !routeMarkerClusterRef.current ||
          gen !== routeMarkerClusterAttachGenerationRef.current;

        if (needsRebuild) {
          if (isMarkerLifecycleDebugEnabled()) {
            /* eslint-disable no-console -- lifecycle */
            console.info('[TmapHome:lifecycle] MarkerCluster 재구성', {
              prevMode,
              gen,
              attachGen: routeMarkerClusterAttachGenerationRef.current,
              routeMarkerCount: routeMarkerMapRef.current.size,
            });
            /* eslint-enable no-console */
          }

          tearDownRouteMarkerCluster();
          routeMarkerMapRef.current.forEach((entry) => {
            entry.marker.setMap(null);
          });
          const MarkerCluster = getTmapv3()?.extension?.MarkerCluster;
          if (!MarkerCluster) {
            routeMarkerRouteDisplayModeRef.current = 'individual';
            routeMarkerClusterAttachGenerationRef.current = -1;
            routeMarkerOverlaySignatureRef.current = '';
            routeMarkerMapRef.current.forEach((entry) => {
              entry.marker.setMap(map);
              entry.isVisible = true;
              entry.outOfViewportSinceMs = null;
            });
            return;
          }

          routeMarkerMapRef.current.forEach((entry) => {
            entry.isVisible = true;
            entry.outOfViewportSinceMs = null;
          });

          const markers = Array.from(routeMarkerMapRef.current.values(), (e) => e.marker);

          if (markers.length > 0) {
            try {
              routeMarkerClusterRef.current = new MarkerCluster({ markers, map });
              routeMarkerClusterAttachGenerationRef.current = gen;
            } catch {
              routeMarkerClusterRef.current = null;
              routeMarkerRouteDisplayModeRef.current = 'individual';
              routeMarkerClusterAttachGenerationRef.current = -1;
              routeMarkerMapRef.current.forEach((entry) => {
                entry.marker.setMap(map);
                entry.isVisible = true;
                entry.outOfViewportSinceMs = null;
              });
              return;
            }

            if (isMarkerLifecycleDebugEnabled()) {
              const inst = routeMarkerClusterRef.current as unknown as {
                getMarkers?: () => unknown[];
                markers?: unknown[];
              };
              let clusterReportsN: number | null = null;
              if (typeof inst.getMarkers === 'function') {
                try {
                  clusterReportsN = inst.getMarkers()?.length ?? null;
                } catch {
                  clusterReportsN = null;
                }
              } else if (Array.isArray(inst.markers)) {
                clusterReportsN = inst.markers.length;
              }
              /* eslint-disable no-console -- lifecycle */
              console.info('[TmapHome:lifecycle] MarkerCluster attach 완료', {
                markersPassedToCtor: markers.length,
                clusterGetMarkersCount: clusterReportsN,
              });
              /* eslint-enable no-console */
            }
          }
        }

        routeMarkerRouteDisplayModeRef.current = 'cluster';
        return;
      }

      tearDownRouteMarkerCluster();
      routeMarkerRouteDisplayModeRef.current = 'individual';
      routeMarkerClusterAttachGenerationRef.current = -1;
      routeMarkerOverlaySignatureRef.current = '';
      routeMarkerMapRef.current.forEach((entry) => {
        entry.marker.setMap(map);
        entry.isVisible = true;
        entry.outOfViewportSinceMs = null;
      });
    },
    [tearDownRouteMarkerCluster],
  );

  const syncMarkerVisibilityByViewport = useCallback(
    (map: TmapMap) => {
      syncRouteMarkersDisplayForZoom(map);
      logRouteMarkerAttachSnapshot(map, 'after syncRouteMarkersDisplayForZoom');
    },
    [syncRouteMarkersDisplayForZoom],
  );

  const scheduleMarkerVisibilitySync = useCallback(
    (map: TmapMap) => {
      if (markerVisibilityTimerRef.current !== null) {
        window.clearTimeout(markerVisibilityTimerRef.current);
      }
      markerVisibilityTimerRef.current = window.setTimeout(() => {
        markerVisibilityTimerRef.current = null;
        syncMarkerVisibilityByViewport(map);
      }, MARKER_VISIBILITY_DEBOUNCE_MS);
    },
    [syncMarkerVisibilityByViewport],
  );

  const enforceMinZoomLevel = useCallback((map: TmapMap): number | null => {
    const currentZoom = map.getZoom();
    if (typeof currentZoom !== 'number') return null;
    if (currentZoom < MIN_ZOOM_LEVEL) {
      map.setZoom(MIN_ZOOM_LEVEL);
      return MIN_ZOOM_LEVEL;
    }
    return currentZoom;
  }, []);

  const scheduleViewportReport = useCallback(
    (map: TmapMap, delay = 220) => {
      if (viewportReportTimerRef.current) {
        window.clearTimeout(viewportReportTimerRef.current);
      }
      viewportReportTimerRef.current = window.setTimeout(() => {
        emitViewportReports(map);
      }, delay);
    },
    [emitViewportReports],
  );

  const getRouteDistanceCategory = (route: Route): DistanceCategory => {
    if (!Number.isFinite(route.distance_meters) || route.distance_meters < 0) {
      return 'BETWEEN_3_AND_5';
    }
    return getDistanceCategory(route.distance_meters);
  };

  // [마커] 현재 위치 마커 생성 및 좌표 갱신
  const createCustomMarker = (map: TmapMap, lat: number, lng: number) => {
    const Tmapv3 = getTmapv3();
    if (!Tmapv3) return;
    currentLocationCoordinateRef.current = { lat, lng };

    const nextPosition = new Tmapv3.LatLng(lat, lng);
    const zoomLevel = map.getZoom();
    const indicatorSize = getCurrentLocationIndicatorSizeByZoom(zoomLevel);
    const icon = getCurrentLocationIndicatorIconUrl(indicatorSize);
    const markerOptions: Record<string, unknown> = {
      position: nextPosition,
      map: map,
      title: '내 현재 위치',
      icon,
      iconSize: new Tmapv3.Size(indicatorSize, indicatorSize),
    };
    if (Tmapv3.Point) {
      markerOptions.iconAnchor = new Tmapv3.Point(indicatorSize / 2, indicatorSize / 2);
    }

    // 줌 레벨에 따라 아이콘 크기가 달라지므로 현재 위치 마커는 갱신 시 재생성한다.
    currentLocationMarkerRef.current?.setMap(null);
    const locationMarker = new Tmapv3.Marker(markerOptions);
    applyPointerCursorToTmapMarker(locationMarker);
    currentLocationMarkerRef.current = locationMarker;
  };

  const registerMapListeners = useCallback(
    (map: TmapMap) => {
      if (mapListenersRegisteredRef.current) return;

      const bindMapEvent = (eventNames: string[], callback: () => void): boolean => {
        let bound = false;
        eventNames.forEach((eventName) => {
          if (typeof map.on === 'function') {
            map.on(eventName, callback);
            bound = true;
            return;
          }
          if (typeof map.addListener === 'function') {
            map.addListener(eventName, callback);
            bound = true;
          }
        });
        return bound;
      };

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
          syncRouteMarkersDisplayForZoom(map);
          scheduleMarkerVisibilitySync(map);
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
        if (currentZoom === lastAppliedZoomRef.current) {
          syncRouteMarkersDisplayForZoom(map);
          scheduleMarkerVisibilitySync(map);
          scheduleViewportReport(map);
          logMarkerCoordinateAudit(map, 'zoomEnd_sameZoomLevel');
          return;
        }
        lastAppliedZoomRef.current = currentZoom;
        if (zoomUpdateRafRef.current !== null) return;
        zoomUpdateRafRef.current = window.requestAnimationFrame(() => {
          zoomUpdateRafRef.current = null;
          const currentLocation = currentLocationCoordinateRef.current;
          if (currentLocation) {
            createCustomMarker(map, currentLocation.lat, currentLocation.lng);
          }
          syncRouteMarkersDisplayForZoom(map);
          scheduleMarkerVisibilitySync(map);
          scheduleViewportReport(map);
          logMarkerCoordinateAudit(map, 'zoomEnd_afterRaf');
        });
      };

      const boundZoomEvents = bindMapEvent(['zoom_end', 'zoomend', 'idle'], handleZoomChanged);

      const reportAfterMove = () => {
        syncRouteMarkersDisplayForZoom(map);
        scheduleMarkerVisibilitySync(map);
        scheduleViewportReport(map);
      };

      const boundMoveEvents = bindMapEvent(
        ['dragend', 'dragEnd', 'moveend', 'panend'],
        reportAfterMove,
      );

      // 상호작용(이동/줌) 중 마커 visibility 토글이 깜빡임을 유발할 수 있어 플래그로 제어한다.
      const boundStartInteractionEvents = bindMapEvent(
        ['drag', 'bounds_changed', 'center_changed', 'zoom', 'zoom_changed'],
        handleStartInteraction,
      );
      const boundEndInteractionEvents = bindMapEvent(
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
      enforceMinZoomLevel,
      isMapInteractingRef,
      logMarkerCoordinateAudit,
      scheduleMarkerVisibilitySync,
      scheduleViewportReport,
      syncRouteMarkersDisplayForZoom,
    ],
  );

  const addMarkerListener = useCallback(
    (marker: TmapMarker, eventName: 'click' | 'mouseover' | 'mouseout', callback: () => void) => {
      if (typeof marker.on === 'function') {
        try {
          marker.on(eventName, callback);
          return;
        } catch {
          // marker.on 실패 시 폴백
        }
      }

      if (typeof marker.addListener === 'function') {
        try {
          marker.addListener(eventName, callback);
        } catch {
          // noop
        }
      }
    },
    [],
  );

  const bindMarkerDomHoverFallback = useCallback(
    (marker: TmapMarker, routeId: string) => {
      const rootElement = marker.getElement?.();
      if (!(rootElement instanceof HTMLElement)) return;

      // SDK hover 이벤트가 누락되는 런타임 대비: DOM mouseenter/leave로 커서 상태를 보강한다.
      rootElement.addEventListener('mouseenter', () => {
        setMarkerHoverCursor(true);
        if (selectedRouteIdRef.current === routeId) return;
        routeVisualStateHandlerRef.current(routeId, 'hover');
      });
      rootElement.addEventListener('mouseleave', () => {
        setMarkerHoverCursor(false);
        if (selectedRouteIdRef.current === routeId) return;
        routeVisualStateHandlerRef.current(routeId, 'default');
      });
    },
    [setMarkerHoverCursor],
  );

  const createRouteMarker = useCallback(
    (
      /** null이면 Marker 생성만 하고 지도 미부착(클러스터가 담당). */
      map: TmapMap | null,
      route: Route,
      category: DistanceCategory,
      visualState: MarkerVisualState,
    ): TmapMarker | null => {
      const Tmapv3 = getTmapv3();
      const routeStart = resolveRouteStartForMapMarker(route);
      if (!Tmapv3 || !routeStart) return null;

      const markerOptions: Record<string, unknown> = {
        position: new Tmapv3.LatLng(routeStart.lat, routeStart.lng),
        icon: getRunningCourseMarkerIconUrlForCategory(category, visualState),
      };
      if (map !== null) {
        markerOptions.map = map;
      }

      const routeMarker = new Tmapv3.Marker(markerOptions) as TmapMarker;
      applyPointerCursorToTmapMarker(routeMarker);
      if (isMarkerCoordDebugEnabled()) {
        const sdkAfterCreate = tryReadSdkLatLngFromMarker(routeMarker);
        /* eslint-disable-next-line no-console -- 마커 생성 직후 좌표 스냅샷 */
        console.log('[TmapHome:createRouteMarker]', {
          routeId: route.id,
          positionInput: { lat: routeStart.lat, lng: routeStart.lng },
          icon: getRunningCourseMarkerIconUrlForCategory(category, visualState),
          visualState,
          sdkGetPositionAfterCreate: sdkAfterCreate,
        });
      }
      return routeMarker;
    },
    [tryReadSdkLatLngFromMarker],
  );

  const attachRouteMarkerListeners = useCallback(
    (marker: TmapMarker, routeId: string) => {
      addMarkerListener(marker, 'mouseover', () => {
        setMarkerHoverCursor(true);
        if (selectedRouteIdRef.current === routeId) return;
        routeVisualStateHandlerRef.current(routeId, 'hover');
      });

      addMarkerListener(marker, 'mouseout', () => {
        setMarkerHoverCursor(false);
        if (selectedRouteIdRef.current === routeId) return;
        routeVisualStateHandlerRef.current(routeId, 'default');
      });

      addMarkerListener(marker, 'click', () => {
        selectedMarkerVisualHandlerRef.current(routeId);
        onCourseMarkerClick?.(routeId);
      });

      bindMarkerDomHoverFallback(marker, routeId);
    },
    [addMarkerListener, bindMarkerDomHoverFallback, onCourseMarkerClick, setMarkerHoverCursor],
  );

  const setRouteMarkerVisualState = useCallback(
    (courseId: string, state: MarkerVisualState) => {
      const markerEntry = routeMarkerMapRef.current.get(courseId);
      if (!markerEntry) return;
      markerEntry.visualState = state;

      const icon = getRunningCourseMarkerIconUrlForCategory(markerEntry.category, state);
      if (typeof markerEntry.marker.setIcon === 'function') {
        markerEntry.marker.setIcon(icon);
        return;
      }

      const map = mapInstance.current;
      const route = routesRef.current.find((item) => item.id === courseId);
      const routeStart = route ? resolveRouteStartForMapMarker(route) : null;
      if (!map || !route || !routeStart) return;

      const nextMarker = createRouteMarker(
        isTmapRouteMarkerClusterLoaded() ? null : map,
        route,
        markerEntry.category,
        state,
      );
      if (!nextMarker) return;

      markerEntry.marker.setMap(null);
      routeMarkerMapRef.current.set(courseId, {
        marker: nextMarker,
        category: markerEntry.category,
        visualState: state,
        lat: markerEntry.lat,
        lng: markerEntry.lng,
        isVisible: markerEntry.isVisible,
        outOfViewportSinceMs: markerEntry.outOfViewportSinceMs,
      });
      attachRouteMarkerListeners(nextMarker, courseId);

      routeMarkerClusterGenerationRef.current += 1;
      syncRouteMarkersDisplayForZoom(map);
    },
    [attachRouteMarkerListeners, createRouteMarker, syncRouteMarkersDisplayForZoom],
  );
  routeVisualStateHandlerRef.current = setRouteMarkerVisualState;

  const syncSelectedRoutePolyline = useCallback((courseId: string | null) => {
    routePolylineGenerationRef.current += 1;
    const generation = routePolylineGenerationRef.current;

    routePolylineAbortRef.current?.abort();
    routePolylineAbortRef.current = null;

    selectedRoutePolylineRef.current?.setMap(null);
    selectedRoutePolylineRef.current = null;

    if (!courseId) {
      return;
    }

    const map = mapInstance.current;
    const Tmapv3 = getTmapv3();
    if (!map || !Tmapv3) {
      return;
    }

    const route = routesRef.current.find((item) => item.id === courseId);
    if (!route) {
      return;
    }

    const fallbackLine = dedupeConsecutiveCoordinates(
      extractPathCoordinates(route.path_data, route.id),
    );
    const savedPoints = extractSavedRoutePoints(route.path_data);

    const abortController = new AbortController();
    routePolylineAbortRef.current = abortController;

    const isStale = (): boolean =>
      generation !== routePolylineGenerationRef.current || selectedRouteIdRef.current !== courseId;

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
          if (abortController.signal.aborted) {
            return;
          }
          console.warn('[TmapHome] 보행자 경로 재계산 실패, 저장 path 사용:', error);
        }
      }

      if (isStale()) {
        return;
      }

      const liveMap = mapInstance.current;
      const liveTmap = getTmapv3();
      if (!liveMap || !liveTmap || lineCoordinates.length < 2) {
        return;
      }

      const latLngPath = lineCoordinates.map(
        (coordinate) => new liveTmap.LatLng(coordinate.lat, coordinate.lng),
      );

      selectedRoutePolylineRef.current = new liveTmap.Polyline({
        map: liveMap,
        path: latLngPath,
        strokeColor: '#2F80FF',
        strokeWeight: 6,
        strokeOpacity: 0.95,
      });

      if (typeof liveMap.fitBounds === 'function') {
        const latValues = lineCoordinates.map((c) => c.lat);
        const lngValues = lineCoordinates.map((c) => c.lng);
        const rawMinLat = Math.min(...latValues);
        const rawMaxLat = Math.max(...latValues);
        const rawMinLng = Math.min(...lngValues);
        const rawMaxLng = Math.max(...lngValues);
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
        clampRoutePolylineFitZoom(liveMap);
        clampHomeMapZoom(liveMap);
      }
    })();
  }, []);

  /** 전체 코스 마커·폴리라인·클러스터 초기화(필요 시 effect/핸들러에서 호출) */
  const _clearRouteMarkers = useCallback(() => {
    if (isMarkerLifecycleDebugEnabled()) {
      /* eslint-disable no-console -- lifecycle */
      console.warn('[TmapHome:lifecycle] clearRouteMarkers() 호출 — 코스 마커 전량 제거');
      console.trace();
      /* eslint-enable no-console */
    }
    tearDownRouteMarkerCluster();
    routePolylineGenerationRef.current += 1;
    routePolylineAbortRef.current?.abort();
    routePolylineAbortRef.current = null;
    selectedRoutePolylineRef.current?.setMap(null);
    selectedRoutePolylineRef.current = null;
    routeMarkerMapRef.current.forEach((entry) => {
      entry.marker.setMap(null);
    });
    routeMarkerMapRef.current.clear();
    routeMarkerRouteDisplayModeRef.current = 'individual';
    routeMarkerClusterAttachGenerationRef.current = -1;
    routeMarkerOverlaySignatureRef.current = '';
    routesSyncSigRef.current = null;
  }, [tearDownRouteMarkerCluster]);

  const syncSelectedMarkerVisual = useCallback(
    (nextSelectedCourseId: string | null) => {
      const previousSelectedId = selectedRouteIdRef.current;

      if (previousSelectedId && previousSelectedId !== nextSelectedCourseId) {
        setRouteMarkerVisualState(previousSelectedId, 'default');
      }

      selectedRouteIdRef.current = nextSelectedCourseId;

      if (nextSelectedCourseId) {
        setRouteMarkerVisualState(nextSelectedCourseId, 'clicked');
      }
      syncSelectedRoutePolyline(nextSelectedCourseId);
    },
    [setRouteMarkerVisualState, syncSelectedRoutePolyline],
  );
  selectedMarkerVisualHandlerRef.current = syncSelectedMarkerVisual;

  const syncRouteMarkers = useCallback(
    (map: TmapMap, nextRoutes: Route[]) => {
      if (isMarkerLifecycleDebugEnabled()) {
        /* eslint-disable no-console -- lifecycle */
        console.info('[TmapHome:lifecycle] syncRouteMarkers 진입', {
          nextRouteCount: nextRoutes.length,
          entriesBefore: routeMarkerMapRef.current.size,
          dataSignature: buildRoutesSyncSignature(nextRoutes),
        });
        console.trace();
        /* eslint-enable no-console */
      }

      const normalizedRoutes = nextRoutes
        .map((route) => ({
          route,
          start: resolveRouteStartForMapMarker(route),
        }))
        .filter(
          (item): item is { route: Route; start: { lat: number; lng: number } } =>
            item.start !== null,
        );

      const nextIdSet = new Set(normalizedRoutes.map(({ route }) => route.id));

      const removedIds: string[] = [];
      routeMarkerMapRef.current.forEach((_entry, routeId) => {
        if (!nextIdSet.has(routeId)) removedIds.push(routeId);
      });

      let clusterStructureChanged = removedIds.length > 0;

      if (removedIds.length > 0) {
        tearDownRouteMarkerCluster();
        removedIds.forEach((routeId) => {
          const entry = routeMarkerMapRef.current.get(routeId);
          entry?.marker.setMap(null);
          routeMarkerMapRef.current.delete(routeId);
        });
      }

      normalizedRoutes.forEach(({ route, start }) => {
        const category = getRouteDistanceCategory(route);
        const state: MarkerVisualState =
          selectedRouteIdRef.current === route.id ? 'clicked' : 'default';

        const existing = routeMarkerMapRef.current.get(route.id);
        if (!existing) {
          return;
        }

        let discardExisting = false;

        if (existing.lat !== start.lat || existing.lng !== start.lng) {
          const Tmapv3 = getTmapv3();
          if (Tmapv3 && typeof existing.marker.setPosition === 'function') {
            existing.marker.setPosition(new Tmapv3.LatLng(start.lat, start.lng) as TmapLatLng);
            existing.lat = start.lat;
            existing.lng = start.lng;
            clusterStructureChanged = true;
          } else {
            discardExisting = true;
          }
        }

        if (discardExisting) {
          clusterStructureChanged = true;
          tearDownRouteMarkerCluster();
          existing.marker.setMap(null);
          routeMarkerMapRef.current.delete(route.id);
          return;
        }

        const categoryChanged = existing.category !== category;
        const stateChanged = existing.visualState !== state;

        if (categoryChanged) {
          existing.category = category;
          clusterStructureChanged = true;
        }

        if (stateChanged || categoryChanged) {
          existing.visualState = state;
          const icon = getRunningCourseMarkerIconUrlForCategory(category, state);
          existing.marker.setIcon?.(icon);
        }
      });

      const routesToCreate = normalizedRoutes.filter(
        ({ route }) => !routeMarkerMapRef.current.has(route.id),
      );

      if (routesToCreate.length > 0) {
        clusterStructureChanged = true;
        tearDownRouteMarkerCluster();

        routesToCreate.forEach(({ route, start }) => {
          const category = getRouteDistanceCategory(route);
          const state: MarkerVisualState =
            selectedRouteIdRef.current === route.id ? 'clicked' : 'default';

          const marker = createRouteMarker(
            isTmapRouteMarkerClusterLoaded() ? null : map,
            route,
            category,
            state,
          );
          if (!marker) return;

          routeMarkerMapRef.current.set(route.id, {
            marker,
            category,
            visualState: state,
            lat: start.lat,
            lng: start.lng,
            isVisible: true,
            outOfViewportSinceMs: null,
          });

          attachRouteMarkerListeners(marker, route.id);
        });
      }

      if (clusterStructureChanged) {
        routeMarkerClusterGenerationRef.current += 1;
      }

      routesSyncSigRef.current = buildRoutesSyncSignature(nextRoutes);
      syncRouteMarkersDisplayForZoom(map);
      logRouteMarkerAttachSnapshot(map, 'syncRouteMarkers 종료 직후');
    },
    [
      attachRouteMarkerListeners,
      createRouteMarker,
      syncRouteMarkersDisplayForZoom,
      tearDownRouteMarkerCluster,
    ],
  );

  // [이벤트] 현재 위치 재탐색 버튼 처리
  const handleRefreshLocation = () => {
    const map = mapInstance.current;
    if (!map || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const Tmapv3 = getTmapv3();
        if (Tmapv3) {
          map.setCenter(new Tmapv3.LatLng(latitude, longitude));
          createCustomMarker(map, latitude, longitude);
        }
      },
      (error) => {
        console.error('위치 갱신 실패:', error);
        alert('위치 정보를 가져올 수 없습니다.');
      },
      PRECISE_GEOLOCATION_OPTIONS,
    );
  };

  const adjustZoomLevel = useCallback((delta: 1 | -1) => {
    const map = mapInstance.current;
    if (!map) return;

    const runtimeZoom = map.getZoom();
    if (typeof runtimeZoom !== 'number') return;
    const nextZoom =
      delta < 0
        ? Math.max(MIN_ZOOM_LEVEL, runtimeZoom + delta)
        : Math.min(MAX_ZOOM_LEVEL, runtimeZoom + delta);
    if (nextZoom === runtimeZoom) return;
    // Tmap이 제공하는 zoomIn/zoomOut을 우선 사용해 부드러운 전환을 유도한다.
    if (delta > 0 && typeof map.zoomIn === 'function') {
      map.zoomIn();
      return;
    }
    if (delta < 0 && typeof map.zoomOut === 'function') {
      map.zoomOut();
      return;
    }

    // zoomIn/zoomOut 미지원 런타임에서는 애니메이션 옵션을 포함해 폴백한다.
    map.setZoom(nextZoom, { animation: true, animate: true, duration: 200 });
  }, []);

  // [이벤트] 휠 줌을 버튼과 동일한 제한 로직으로 통일
  const handleMapWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      const map = mapInstance.current;
      if (!map) return;
      if (wheelZoomThrottleTimerRef.current !== null) return;

      const delta: 1 | -1 = event.deltaY < 0 ? 1 : -1;
      adjustZoomLevel(delta);
      scheduleViewportReport(map);

      wheelZoomThrottleTimerRef.current = window.setTimeout(() => {
        wheelZoomThrottleTimerRef.current = null;
      }, 100);
    },
    [adjustZoomLevel, scheduleViewportReport],
  );

  useEffect(() => {
    routesRef.current = routes;
  }, [routes]);

  useEffect(() => {
    // [초기화] 지도 라이브러리 로드 대기 및 최초 지도 생성
    let cancelled = false;

    const initTmap = (lat: number, lng: number) => {
      if (cancelled) return;
      const Tmapv3 = getTmapv3();
      if (!Tmapv3 || mapInstance.current) return;

      const map = new Tmapv3.Map('map_div', {
        center: new Tmapv3.LatLng(lat, lng),
        width: '100%',
        height: '100%',
        zoom: INITIAL_MAP_ZOOM_LEVEL,
        minZoom: MIN_ZOOM_LEVEL,
        zoomControl: false,
        scrollwheel: false,
      });

      map.setZoomLimit?.(MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
      lastAppliedZoomRef.current = map.getZoom();
      createCustomMarker(map, lat, lng);
      mapInstance.current = map;
      enforceMinZoomLevel(map);
      registerMapListeners(map);
      scheduleViewportReport(map, 500);
      if (viewportSyncIntervalRef.current !== null) {
        window.clearInterval(viewportSyncIntervalRef.current);
      }
      // 이벤트 누락 환경에서도 뷰포트 기반 마커/카드 동기화를 보장한다.
      viewportSyncIntervalRef.current = window.setInterval(() => {
        // 이동/줌 상호작용 중에는 마커 setMap(null) 토글로 인한 깜빡임을 줄인다.
        if (!isMapInteractingRef.current) {
          scheduleMarkerVisibilitySync(map);
        }
        emitViewportReports(map);
      }, 450);
      syncRouteMarkers(map, routesRef.current);
    };

    const startWithLocation = () => {
      if (typeof window !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            initTmap(position.coords.latitude, position.coords.longitude);
          },
          () => {
            initTmap(SEOUL_CITY_HALL_COORDINATE.lat, SEOUL_CITY_HALL_COORDINATE.lng);
          },
          DEFAULT_GEOLOCATION_OPTIONS,
        );
      } else {
        initTmap(SEOUL_CITY_HALL_COORDINATE.lat, SEOUL_CITY_HALL_COORDINATE.lng);
      }
    };

    const checkLibrary = () => {
      if (getTmapv3()) {
        startWithLocation();
      } else {
        setTimeout(checkLibrary, 100);
      }
    };

    checkLibrary();

    const routeMarkerMap = routeMarkerMapRef.current;

    return () => {
      cancelled = true;
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
      routePolylineAbortRef.current?.abort();
      routePolylineAbortRef.current = null;
      routePolylineGenerationRef.current += 1;
      selectedRoutePolylineRef.current?.setMap(null);
      routeMarkerMap.clear();
      mapInstance.current = null;
      currentLocationMarkerRef.current = null;
      currentLocationCoordinateRef.current = null;
      selectedRoutePolylineRef.current = null;
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
      if (wheelZoomThrottleTimerRef.current !== null) {
        window.clearTimeout(wheelZoomThrottleTimerRef.current);
        wheelZoomThrottleTimerRef.current = null;
      }
      if (zoomUpdateRafRef.current !== null) {
        window.cancelAnimationFrame(zoomUpdateRafRef.current);
        zoomUpdateRafRef.current = null;
      }
      if (markerVisibilityTimerRef.current !== null) {
        window.clearTimeout(markerVisibilityTimerRef.current);
        markerVisibilityTimerRef.current = null;
      }
      lastAppliedZoomRef.current = null;
      lastQueryViewportRef.current = null;
      lastVisibleViewportReportRef.current = null;
    };
  }, [
    emitViewportReports,
    enforceMinZoomLevel,
    registerMapListeners,
    scheduleMarkerVisibilitySync,
    scheduleViewportReport,
    syncRouteMarkers,
    isMapInteractingRef,
    interactionWatchdogTimerRef,
  ]);

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

    syncRouteMarkers(map, routes);
    scheduleMarkerVisibilitySync(map);
  }, [routes, scheduleMarkerVisibilitySync, syncRouteMarkers]);

  useEffect(() => {
    // [동기화] 외부 선택 상태(selectedCourseId)와 마커 clicked 상태 정합성 유지
    syncSelectedMarkerVisual(selectedCourseId);
    const map = mapInstance.current;
    if (map) {
      scheduleMarkerVisibilitySync(map);
    }
  }, [selectedCourseId, scheduleMarkerVisibilitySync, syncSelectedMarkerVisual]);

  // [마커 클릭] 바텀시트 높이가 반영된 뒤, 보이는 지도 영역의 시각적 중앙에 마커가 오도록 1회만 패닝
  useEffect(() => {
    if (!markerClickRecenterToken || !selectedCourseId) {
      return;
    }

    const sheetPx = bottomSheetVisibleHeightRef.current;
    if (sheetPx <= 24) {
      return;
    }

    const completionKey = `${markerClickRecenterToken}|${selectedCourseId}`;
    if (lastMarkerRecenterSignatureRef.current === completionKey) {
      return;
    }
    lastMarkerRecenterSignatureRef.current = completionKey;

    const map = mapInstance.current;
    const Tmapv3 = getTmapv3();
    if (!map || !Tmapv3) {
      return;
    }

    const route = routesRef.current.find((item) => item.id === selectedCourseId);
    const entry = routeMarkerMapRef.current.get(selectedCourseId);
    const routeStart = route ? resolveRouteStartForMapMarker(route) : null;
    const start = routeStart ?? (entry ? { lat: entry.lat, lng: entry.lng } : null);
    if (!start) {
      return;
    }

    map.setCenter(new Tmapv3.LatLng(start.lat, start.lng));

    requestAnimationFrame(() => {
      const liveMap = mapInstance.current;
      const liveTmap = getTmapv3();
      if (!liveMap || !liveTmap) {
        return;
      }

      const liveSheetPx = Math.max(24, bottomSheetVisibleHeightRef.current);
      const mapElement = document.getElementById('map_div');
      const mapHeightPx = mapElement?.clientHeight ?? 0;
      if (mapHeightPx <= 0) {
        return;
      }

      const bounds = liveMap.getBounds?.();
      const northEast = bounds?.getNorthEast?.();
      const southWest = bounds?.getSouthWest?.();
      if (!bounds || !northEast || !southWest) {
        return;
      }

      const northEastLat = readCoordinateValue(northEast, 'lat');
      const southWestLat = readCoordinateValue(southWest, 'lat');
      if (northEastLat === null || southWestLat === null) {
        return;
      }

      const latSpan = northEastLat - southWestLat;
      const pixelOffsetY = -(liveSheetPx / 2);
      const adjustedLat = start.lat + (pixelOffsetY / mapHeightPx) * latSpan;

      liveMap.setCenter(new liveTmap.LatLng(adjustedLat, start.lng));
    });
  }, [markerClickRecenterToken, selectedCourseId, bottomSheetVisibleHeight, readCoordinateValue]);

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
      if (viewportReportTimerRef.current) {
        window.clearTimeout(viewportReportTimerRef.current);
        viewportReportTimerRef.current = null;
      }
      if (viewportSyncIntervalRef.current !== null) {
        window.clearInterval(viewportSyncIntervalRef.current);
        viewportSyncIntervalRef.current = null;
      }
    };
  }, []);

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
      syncRouteMarkersDisplayForZoom(map);
    };

    window.addEventListener('resize', handleViewportResize);
    window.visualViewport?.addEventListener('resize', handleViewportResize);
    return () => {
      window.removeEventListener('resize', handleViewportResize);
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, [emitViewportReports, syncRouteMarkersDisplayForZoom]);

  const sheetControlPositionClassName =
    bottomSheetVisibleHeight <= 24 ? styles.sheetControlsCollapsed : styles.sheetControlsPeek;
  const shouldHideFloatingControls =
    isBottomSheetExpanded || (isMobileOrTabletViewport && bottomSheetVisibleHeight >= 320);

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
