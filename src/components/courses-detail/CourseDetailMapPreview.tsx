/**
 * CourseDetailMapPreview — 코스 상세 상단 미리보기 지도 렌더러.
 */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { Route } from '@/commons/types/runroute';
import type { TmapV3 } from '@/commons/types/tmap';
import {
  getWaypointMarkerIconUrl,
  type WaypointMarkerRole,
} from '@/components/tmap/shared/build-waypoint-marker-icon';
import { getPedestrianRoute } from '@/repositories/map.repository';

import styles from './styles.module.css';

type CourseDetailMapPreviewProps = {
  course: Route;
  mapLabel: string;
};

/** 홈 지도(TmapHome)와 동일한 줌 범위 */
const MIN_ZOOM_LEVEL = 11;
const MAX_ZOOM_LEVEL = 19;

type CoordinateSystem = 'WGS84_LNGLAT' | 'WGS84_LATLNG' | 'EPSG3857';
type LatLng = { lat: number; lng: number };
type CoordinatePair = [number, number];
type CoordinateCandidate = { keyPath: string; pairs: CoordinatePair[] };

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

type WaypointMarkerModel = {
  lat: number;
  lng: number;
  role: WaypointMarkerRole;
  label: string;
};

function toWgs84FromEpsg3857(x: number, y: number): LatLng {
  const normalizedLng = (x / 20037508.34) * 180;
  const projectedLat = (y / 20037508.34) * 180;
  const normalizedLat =
    (180 / Math.PI) * (2 * Math.atan(Math.exp((projectedLat * Math.PI) / 180)) - Math.PI / 2);

  return { lat: normalizedLat, lng: normalizedLng };
}

function normalizeWgs84Coordinate(lat: number, lng: number): LatLng | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function detectCoordinateSystem(coordinates: number[][]): CoordinateSystem {
  let lngLatCount = 0;
  let latLngCount = 0;

  coordinates.forEach(([first, second]) => {
    if (Math.abs(first) <= 180 && Math.abs(second) <= 90) lngLatCount += 1;
    if (Math.abs(first) <= 90 && Math.abs(second) <= 180) latLngCount += 1;
  });

  if (lngLatCount === 0 && latLngCount === 0) return 'EPSG3857';
  return lngLatCount >= latLngCount ? 'WGS84_LNGLAT' : 'WGS84_LATLNG';
}

function normalizeCoordinatePair(
  value: CoordinatePair,
  coordinateSystem: CoordinateSystem = 'WGS84_LNGLAT',
): LatLng | null {
  const first = Number(value[0]);
  const second = Number(value[1]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;

  if (coordinateSystem === 'EPSG3857') {
    return toWgs84FromEpsg3857(first, second);
  }

  if (coordinateSystem === 'WGS84_LATLNG') {
    return normalizeWgs84Coordinate(first, second);
  }

  return normalizeWgs84Coordinate(second, first);
}

function parseCoordinatePair(value: unknown): CoordinatePair | null {
  if (Array.isArray(value) && value.length >= 2) {
    const x = Number(value[0]);
    const y = Number(value[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) return [x, y];
    return null;
  }

  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const lat = Number(record.lat);
    const lng = Number(record.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return [lng, lat];
    }
  }

  return null;
}

function parseCoordinateSequence(value: unknown): CoordinatePair[] {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if ('coordinates' in record) {
      return parseCoordinateSequence(record.coordinates);
    }
    return [];
  }
  if (!Array.isArray(value)) return [];

  const sequence: CoordinatePair[] = [];
  value.forEach((item) => {
    const pair = parseCoordinatePair(item);
    if (pair) {
      sequence.push(pair);
      return;
    }

    const nested = parseCoordinateSequence(item);
    if (nested.length > 0) sequence.push(...nested);
  });
  return sequence;
}

function parseJsonIfString(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function collectCoordinateCandidates(
  rawValue: unknown,
  keyPath = 'root',
  result: CoordinateCandidate[] = [],
): CoordinateCandidate[] {
  const value = parseJsonIfString(rawValue);

  if (Array.isArray(value)) {
    const sequence = parseCoordinateSequence(value);
    if (sequence.length >= 2) {
      result.push({ keyPath, pairs: sequence });
    }

    value.forEach((item, index) => {
      collectCoordinateCandidates(item, `${keyPath}[${index}]`, result);
    });
    return result;
  }

  if (typeof value !== 'object' || value === null) return result;
  const record = value as Record<string, unknown>;

  const geometry = parseJsonIfString(record.geometry);
  if (typeof geometry === 'object' && geometry !== null) {
    const geometryRecord = geometry as Record<string, unknown>;
    if (String(geometryRecord.type ?? '') === 'LineString') {
      const sequence = parseCoordinateSequence(parseJsonIfString(geometryRecord.coordinates));
      if (sequence.length >= 2) {
        result.push({ keyPath: `${keyPath}.geometry.coordinates`, pairs: sequence });
      }
    }
  }

  Object.entries(record).forEach(([key, nested]) => {
    const resolvedNested = parseJsonIfString(nested);
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'path' || lowerKey === 'features' || lowerKey === 'coordinates') {
      const sequence = parseCoordinateSequence(resolvedNested);
      if (sequence.length >= 2) {
        result.push({ keyPath: `${keyPath}.${key}`, pairs: sequence });
      }
    }
    collectCoordinateCandidates(resolvedNested, `${keyPath}.${key}`, result);
  });

  return result;
}

function normalizePathData(rawPathData: unknown): Record<string, unknown> | null {
  const data = parseJsonIfString(rawPathData);
  if (typeof data === 'string') {
    console.error('[CourseDetailMapPreview] path_data 문자열 JSON.parse 실패');
    return null;
  }
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  if (Array.isArray(data)) {
    try {
      return { path: data };
    } catch {
      return null;
    }
  }
  console.error('[CourseDetailMapPreview] path_data 타입이 객체/문자열이 아닙니다.');
  return null;
}

/** 등록 시 저장된 출발·경유·도착 지점 (`points` 또는 DB 저장 필드 `waypoint_points`) */
function extractSavedRoutePoints(rawPathData: unknown): LatLng[] {
  const pathData = normalizePathData(rawPathData);
  if (!pathData) return [];

  const pts = pathData.points;
  const wps = pathData.waypoint_points;
  const rawPoints =
    (Array.isArray(pts) && pts.length > 0 ? pts : null) ??
    (Array.isArray(wps) && wps.length > 0 ? wps : null) ??
    (Array.isArray(pts) ? pts : null) ??
    (Array.isArray(wps) ? wps : null);
  if (!rawPoints?.length) return [];

  const result: LatLng[] = [];
  rawPoints.forEach((item) => {
    if (typeof item !== 'object' || item === null) return;
    const record = item as Record<string, unknown>;
    const lat = Number(record.lat);
    const lng = Number(record.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      result.push({ lat, lng });
    }
  });
  return result;
}

function extractPathCoordinates(rawPathData: unknown, courseId: string): LatLng[] {
  const pathData = normalizePathData(rawPathData);
  if (!pathData) return [];
  if (Object.keys(pathData).length === 0) {
    console.error(
      `[CourseDetailMapPreview] path_data가 비어 있습니다. (courseId: ${courseId}) 등록 로직(useCourseMap.ts)에서 path_data 저장값을 점검해 주세요.`,
    );
    return [];
  }

  const candidates = collectCoordinateCandidates(pathData)
    .map((candidate) => {
      const key = candidate.keyPath.toLowerCase();
      const isPrimary =
        key.includes('.path') || key.includes('.features') || key.includes('linestring');
      return { ...candidate, isPrimary };
    })
    .filter((candidate) => candidate.pairs.length >= 2);

  if (candidates.length === 0) {
    console.error(
      `[CourseDetailMapPreview] 파싱 실패: path/features/fallback 어디에서도 유효한 좌표열을 찾지 못했습니다. (courseId: ${courseId})`,
    );
    return [];
  }

  const primaryCandidates = candidates.filter((candidate) => candidate.isPrimary);
  const pool = primaryCandidates.length > 0 ? primaryCandidates : candidates;
  const bestCandidate = pool.reduce((best, current) =>
    current.pairs.length > best.pairs.length ? current : best,
  );
  const coordinateSystem = detectCoordinateSystem(bestCandidate.pairs);

  const normalized = bestCandidate.pairs
    .map((pair) => normalizeCoordinatePair(pair, coordinateSystem))
    .filter((item): item is LatLng => item !== null);
  if (normalized.length < 2) {
    console.error('[CourseDetailMapPreview] 파싱 실패: 좌표 정규화 후 좌표 개수가 2개 미만입니다.');
  }
  return normalized;
}

function dedupeConsecutiveCoordinates(coordinates: LatLng[]): LatLng[] {
  if (coordinates.length <= 1) return coordinates;

  const deduped: LatLng[] = [coordinates[0]];
  for (let i = 1; i < coordinates.length; i += 1) {
    const previous = deduped[deduped.length - 1];
    const current = coordinates[i];
    if (previous.lat === current.lat && previous.lng === current.lng) continue;
    deduped.push(current);
  }
  return deduped;
}

function safelyDetachOverlay(overlay: MapDetachableOverlay | null): void {
  if (!overlay) return;
  try {
    overlay.setMap(null);
  } catch (error) {
    console.warn('[CourseDetailMapPreview] overlay detach skipped:', error);
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

function registerZoomClampListeners(map: CourseDetailMapInstance): () => void {
  const callback = () => {
    clampZoomLevel(map);
  };

  ZOOM_CLAMP_EVENT_NAMES.forEach((eventName) => {
    if (typeof map.on === 'function') {
      map.on(eventName, callback);
      return;
    }
    if (typeof map.addListener === 'function') {
      map.addListener(eventName, callback);
    }
  });

  return () => {
    ZOOM_CLAMP_EVENT_NAMES.forEach((eventName) => {
      map.off?.(eventName, callback);
    });
  };
}

function buildWaypointMarkerModels(
  savedPoints: LatLng[],
  pathCoords: LatLng[],
  startLat: number,
  startLng: number,
): WaypointMarkerModel[] {
  if (savedPoints.length >= 2) {
    return savedPoints.map((coord, index, arr) => {
      const isStart = index === 0;
      const isEnd = index === arr.length - 1;
      const role: WaypointMarkerRole = isStart ? 'start' : isEnd ? 'end' : 'via';
      const label = isStart ? 'S' : isEnd ? 'E' : String(index);
      return { lat: coord.lat, lng: coord.lng, role, label };
    });
  }

  if (pathCoords.length >= 2) {
    const last = pathCoords[pathCoords.length - 1];
    return [
      { lat: pathCoords[0].lat, lng: pathCoords[0].lng, role: 'start', label: 'S' },
      { lat: last.lat, lng: last.lng, role: 'end', label: 'E' },
    ];
  }

  if (Number.isFinite(startLat) && Number.isFinite(startLng)) {
    return [{ lat: startLat, lng: startLng, role: 'start', label: 'S' }];
  }

  return [];
}

function sanitizeDomIdSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export default function CourseDetailMapPreview({ course, mapLabel }: CourseDetailMapPreviewProps) {
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
        console.warn('[CourseDetailMapPreview] 보행자 경로 재계산 실패, 저장 path 사용:', error);
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
      const Tmapv3 = window.Tmapv3 as TmapV3Runtime | undefined;
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

    const Tmapv3 = window.Tmapv3 as TmapV3Runtime | undefined;
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
          // Tmap 공식 예제와 동일하게 LatLng(lat, lon) 순서로 변환한다.
          position: new Tmapv3.LatLng(model.lat, model.lng),
          icon: getWaypointMarkerIconUrl(model.role),
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
        const minLat = Math.min(...latValues);
        const maxLat = Math.max(...latValues);
        const minLng = Math.min(...lngValues);
        const maxLng = Math.max(...lngValues);
        const southWest = new Tmapv3.LatLng(minLat, minLng);
        const northEast = new Tmapv3.LatLng(maxLat, maxLng);

        if (typeof Tmapv3.LatLngBounds === 'function') {
          const bounds = new Tmapv3.LatLngBounds(southWest, northEast);
          mapInstance.fitBounds(bounds, 24);
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
  }, [mapReady, course.start_lat, course.start_lng, lineCoordinates, waypointMarkerModels]);

  return (
    <div className={styles.mapPreviewInner}>
      <div id={mapContainerId} className={styles.mapCanvas} aria-label={mapLabel} />
    </div>
  );
}
