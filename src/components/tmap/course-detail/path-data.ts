/**
 * 코스 상세 지도용 path_data 파싱·웨이포인트 모델 생성.
 */

import type { WaypointMarkerRole } from '@/components/tmap/shared/build-waypoint-marker-icon';

const LOG = '[TmapCourseDetail]';

export type LatLng = { lat: number; lng: number };

type CoordinateSystem = 'WGS84_LNGLAT' | 'WGS84_LATLNG' | 'EPSG3857';
type CoordinatePair = [number, number];
type CoordinateCandidate = { keyPath: string; pairs: CoordinatePair[] };

export type WaypointMarkerModel = {
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
    console.error(`${LOG} path_data 문자열 JSON.parse 실패`);
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
  console.error(`${LOG} path_data 타입이 객체/문자열이 아닙니다.`);
  return null;
}

/** 등록 시 저장된 출발·경유·도착 지점 (`points` 또는 DB 저장 필드 `waypoint_points`) */
export function extractSavedRoutePoints(rawPathData: unknown): LatLng[] {
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

export function extractPathCoordinates(rawPathData: unknown, courseId: string): LatLng[] {
  const pathData = normalizePathData(rawPathData);
  if (!pathData) return [];
  if (Object.keys(pathData).length === 0) {
    console.error(
      `${LOG} path_data가 비어 있습니다. (courseId: ${courseId}) 등록 로직(useCourseMap.ts)에서 path_data 저장값을 점검해 주세요.`,
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
      `${LOG} 파싱 실패: path/features/fallback 어디에서도 유효한 좌표열을 찾지 못했습니다. (courseId: ${courseId})`,
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
    console.error(`${LOG} 파싱 실패: 좌표 정규화 후 좌표 개수가 2개 미만입니다.`);
  }
  return normalized;
}

export function dedupeConsecutiveCoordinates(coordinates: LatLng[]): LatLng[] {
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

export function buildWaypointMarkerModels(
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

export function sanitizeDomIdSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}
