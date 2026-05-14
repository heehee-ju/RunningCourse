/**
 * TmapCourseDetail — 코스 상세 상단(·등록 수정) 미리보기 Tmap v3 렌더러.
 * 홈 TmapHome과 동일하게 `tmap/course-detail`에서 관리한다.
 */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { Route } from '@/commons/types/runroute';
import type { TmapV3 } from '@/commons/types/tmap';
import { getWaypointMarkerIconUrl } from '@/commons/utils/marker/waypoint-marker';
import {
  buildWaypointMarkerModels,
  dedupeConsecutiveCoordinates,
  extractPathCoordinates,
  extractSavedRoutePoints,
  type LatLng,
  sanitizeDomIdSegment,
} from '@/commons/utils/route/path-parser';
import { bindMapEvents } from '@/commons/utils/tmap/events';
import { getTmapv3Runtime } from '@/commons/utils/tmap/runtime';
import { getPedestrianRoute } from '@/repositories/map.repository';

import styles from './styles.module.css';

const LOG = '[TmapCourseDetail]';

/** 최소 줌 11 · 최대 15(홈에서 선택 코스 폴리라인 맞출 때와 동일 상한) */
const MIN_ZOOM_LEVEL = 11;
const MAX_ZOOM_LEVEL = 15;

/** fitBounds 경계 여백(px). 값이 클수록 더 넓게(줌 아웃) 보임 */
const FIT_BOUNDS_PADDING_PX = 48;

/**
 * 보행자/저장 path 바운딩이 웨이포인트 대비 비정상적으로 클 때(파싱 오염 등),
 * 미리보기 프레이밍은 저장 지점 기준으로 맞춘다. 폴리라인은 그대로 그린다.
 */
const FRAMING_USE_SAVED_WAYPOINTS_SPAN_RATIO = 3;

type TmapCourseDetailProps = {
  course: Route;
  mapLabel: string;
};

type CourseDetailMapInstance = {
  setCenter?: (target: unknown) => void;
  fitBounds?: (...args: unknown[]) => void;
  getZoom?: () => number;
  setZoom?: (level: number, options?: Record<string, unknown>) => void;
  setZoomLimit?: (minZoom: number, maxZoom: number) => void;
  addListener?: (eventName: string, callback: () => void) => void;
  on?: (eventName: string, callback: () => void) => void;
  off?: (eventName: string, callback: () => void) => void;
  destroy?: () => void;
};

/** 스크립트로 로드되는 Tmap v3 전역에만 있는 타입 보강 */
type TmapV3Runtime = TmapV3 & {
  Point?: new (x: number, y: number) => unknown;
  LatLngBounds?: new (southWest: unknown, northEast: unknown) => unknown;
};

type MapDetachableOverlay = {
  setMap: (map: unknown | null) => void;
};

function safelyDetachOverlay(overlay: MapDetachableOverlay | null): void {
  if (!overlay) return;
  try {
    overlay.setMap(null);
  } catch (error) {
    console.warn(`${LOG} overlay detach skipped:`, error);
  }
}

function clampZoomLevel(map: CourseDetailMapInstance): void {
  const currentZoom = map.getZoom?.();
  if (typeof currentZoom !== 'number') return;
  const clamped = Math.min(MAX_ZOOM_LEVEL, Math.max(MIN_ZOOM_LEVEL, currentZoom));
  if (clamped !== currentZoom) {
    map.setZoom?.(clamped);
  }
}

const ZOOM_CLAMP_EVENT_NAMES = ['zoom_end', 'zoomend', 'idle'] as const;

function maxAxisAlignedSpan(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
): number {
  return Math.max(maxLat - minLat, maxLng - minLng);
}

function registerZoomClampListeners(map: CourseDetailMapInstance): () => void {
  const callback = () => {
    clampZoomLevel(map);
  };

  bindMapEvents(map, [...ZOOM_CLAMP_EVENT_NAMES], callback);

  return () => {
    ZOOM_CLAMP_EVENT_NAMES.forEach((eventName) => {
      map.off?.(eventName, callback);
    });
  };
}

export function TmapCourseDetail({ course, mapLabel }: TmapCourseDetailProps) {
  /** SSR·CSR 동일해야 함(Math.random 금지). 코스별로 컨테이너 분리. */
  const mapContainerId = useMemo(
    () => `course-detail-map-${sanitizeDomIdSegment(course.id)}`,
    [course.id],
  );

  const mapRef = useRef<CourseDetailMapInstance | null>(null);
  const polylineRef = useRef<MapDetachableOverlay | null>(null);
  const waypointMarkersRef = useRef<MapDetachableOverlay[]>([]);
  /** 스타일 로드 후 폴리라인·마커를 그린다(No style loaded 방지). */
  const [mapReady, setMapReady] = useState(false);

  /** 경유지 2개 이상일 때 Tmap 보행자 API로 받은 라인 (실패·언마운트 시 null) */
  const [pedestrianLineCoords, setPedestrianLineCoords] = useState<LatLng[] | null>(null);

  const savedRoutePoints = useMemo(
    () => extractSavedRoutePoints(course.path_data),
    [course.path_data],
  );

  const pathCoordinates = useMemo(() => {
    const parsed = extractPathCoordinates(course.path_data, course.id);
    return dedupeConsecutiveCoordinates(parsed);
  }, [course.id, course.path_data]);

  useEffect(() => {
    if (savedRoutePoints.length < 2) {
      setPedestrianLineCoords(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const coordsForApi = savedRoutePoints.map((p) => ({ lat: p.lat, lng: p.lng }));

    getPedestrianRoute(coordsForApi, controller.signal)
      .then((result) => {
        if (cancelled) return;
        const next = dedupeConsecutiveCoordinates(
          result.path
            .map((c) => ({ lat: Number(c.lat), lng: Number(c.lng) }))
            .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng)),
        );
        setPedestrianLineCoords(next.length >= 2 ? next : null);
      })
      .catch((error) => {
        if (cancelled || controller.signal.aborted) return;
        console.warn(`${LOG} 보행자 경로 재계산 실패, 저장 path 사용:`, error);
        setPedestrianLineCoords(null);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [course.id, savedRoutePoints]);

  const lineCoordinates = useMemo(() => {
    if (pedestrianLineCoords && pedestrianLineCoords.length >= 2) {
      return pedestrianLineCoords;
    }
    return pathCoordinates;
  }, [pathCoordinates, pedestrianLineCoords]);

  const waypointMarkerModels = useMemo(
    () =>
      buildWaypointMarkerModels(
        savedRoutePoints,
        lineCoordinates,
        course.start_lat,
        course.start_lng,
      ),
    [savedRoutePoints, lineCoordinates, course.start_lat, course.start_lng],
  );

  /** 지도 인스턴스 생성·파기 (코스 단위로 언마운트 시 destroy) */
  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | null = null;
    let fallbackReadyTimer: number | null = null;
    let removeZoomClamp: (() => void) | null = null;
    let idleHandler: (() => void) | null = null;

    const tryMountMap = () => {
      if (cancelled) return;
      const rootElement = document.getElementById(mapContainerId);
      const Tmapv3 = getTmapv3Runtime() as TmapV3Runtime | undefined;
      if (!rootElement || !Tmapv3) {
        pollTimer = window.setTimeout(tryMountMap, 120);
        return;
      }

      const mapInstance = new Tmapv3.Map(mapContainerId, {
        center: new Tmapv3.LatLng(course.start_lat, course.start_lng),
        width: '100%',
        height: '100%',
        zoom: 15,
        minZoom: MIN_ZOOM_LEVEL,
        zoomControl: false,
        scrollwheel: false,
      }) as unknown as CourseDetailMapInstance;

      mapRef.current = mapInstance;
      mapInstance.setZoomLimit?.(MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
      clampZoomLevel(mapInstance);
      removeZoomClamp = registerZoomClampListeners(mapInstance);

      let readyOnce = false;
      const notifyReady = () => {
        if (cancelled || readyOnce) return;
        readyOnce = true;
        if (fallbackReadyTimer !== null) {
          window.clearTimeout(fallbackReadyTimer);
          fallbackReadyTimer = null;
        }
        mapInstance.off?.('idle', notifyReady);
        setMapReady(true);
      };

      idleHandler = notifyReady;
      mapInstance.on?.('idle', notifyReady);
      fallbackReadyTimer = window.setTimeout(notifyReady, 900);
    };

    setMapReady(false);
    tryMountMap();

    return () => {
      cancelled = true;
      if (pollTimer !== null) window.clearTimeout(pollTimer);
      if (fallbackReadyTimer !== null) window.clearTimeout(fallbackReadyTimer);

      const mapInstance = mapRef.current;
      if (mapInstance) {
        if (idleHandler) {
          mapInstance.off?.('idle', idleHandler);
        }
        removeZoomClamp?.();
        try {
          mapInstance.destroy?.();
        } catch {
          /* SDK 버전별 destroy 미구현 가능 */
        }
        mapRef.current = null;
      }
    };
  }, [course.start_lat, course.start_lng, mapContainerId]);

  /** 스타일 준비 후 오버레이만 갱신 (경로 데이터 변경 시 재실행) */
  useEffect(() => {
    if (!mapReady) return;

    const Tmapv3 = getTmapv3Runtime() as TmapV3Runtime | undefined;
    const mapInstance = mapRef.current;
    if (!Tmapv3 || !mapInstance) return;

    mapInstance.setZoomLimit?.(MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);

    const clearWaypointMarkers = () => {
      waypointMarkersRef.current.forEach((marker) => safelyDetachOverlay(marker));
      waypointMarkersRef.current = [];
    };

    safelyDetachOverlay(polylineRef.current);
    polylineRef.current = null;
    clearWaypointMarkers();

    const drawMarkers = () => {
      waypointMarkerModels.forEach((model) => {
        const markerOptions: Record<string, unknown> = {
          position: new Tmapv3.LatLng(model.lat, model.lng),
          icon: getWaypointMarkerIconUrl(model.role, model.viaOrder, {
            isRoundTrip: course.is_round_trip,
          }),
          map: mapInstance,
        };

        const marker = new Tmapv3.Marker(markerOptions) as unknown as MapDetachableOverlay;
        waypointMarkersRef.current.push(marker);
      });
    };

    if (lineCoordinates.length >= 2) {
      const latLngPath = lineCoordinates.map(
        (coordinate) => new Tmapv3.LatLng(coordinate.lat, coordinate.lng),
      );
      polylineRef.current = new Tmapv3.Polyline({
        map: mapInstance,
        path: latLngPath,
        strokeColor: '#2F80FF',
        strokeWeight: 6,
        strokeOpacity: 0.95,
      }) as unknown as MapDetachableOverlay;

      drawMarkers();

      if (typeof mapInstance.fitBounds === 'function') {
        const latValues = lineCoordinates.map((coordinate) => coordinate.lat);
        const lngValues = lineCoordinates.map((coordinate) => coordinate.lng);
        let minLat = Math.min(...latValues);
        let maxLat = Math.max(...latValues);
        let minLng = Math.min(...lngValues);
        let maxLng = Math.max(...lngValues);
        const lineSpan = maxAxisAlignedSpan(minLat, maxLat, minLng, maxLng);

        if (savedRoutePoints.length >= 2) {
          const sLat = savedRoutePoints.map((p) => p.lat);
          const sLng = savedRoutePoints.map((p) => p.lng);
          const sminLat = Math.min(...sLat);
          const smaxLat = Math.max(...sLat);
          const sminLng = Math.min(...sLng);
          const smaxLng = Math.max(...sLng);
          const savedSpan = maxAxisAlignedSpan(sminLat, smaxLat, sminLng, smaxLng);
          if (savedSpan > 1e-6 && lineSpan > savedSpan * FRAMING_USE_SAVED_WAYPOINTS_SPAN_RATIO) {
            minLat = sminLat;
            maxLat = smaxLat;
            minLng = sminLng;
            maxLng = smaxLng;
          }
        }

        const southWest = new Tmapv3.LatLng(minLat, minLng);
        const northEast = new Tmapv3.LatLng(maxLat, maxLng);

        if (typeof Tmapv3.LatLngBounds === 'function') {
          const bounds = new Tmapv3.LatLngBounds(southWest, northEast);
          mapInstance.fitBounds(bounds, FIT_BOUNDS_PADDING_PX);
        } else {
          mapInstance.fitBounds(southWest, northEast);
        }
        clampZoomLevel(mapInstance);
      }
    } else {
      mapInstance.setCenter?.(new Tmapv3.LatLng(course.start_lat, course.start_lng));
      drawMarkers();
      clampZoomLevel(mapInstance);
    }

    return () => {
      safelyDetachOverlay(polylineRef.current);
      polylineRef.current = null;
      clearWaypointMarkers();
    };
  }, [
    mapReady,
    course.start_lat,
    course.start_lng,
    course.is_round_trip,
    lineCoordinates,
    savedRoutePoints,
    waypointMarkerModels,
  ]);

  return (
    <div className={styles.root}>
      <div id={mapContainerId} className={styles.map} aria-label={mapLabel} />
    </div>
  );
}

export default TmapCourseDetail;
