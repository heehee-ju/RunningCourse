/**
 * 홈 지도 마커 위치용 시작 좌표 — `path_data` 웨이포인트의 출발점을 DB `start_lat/lng`보다 우선한다.
 */
import type { Route } from '@/commons/types/routerun';
import { normalizeRouteStartForTmapMarker } from '@/commons/utils/tmap-coordinate-normalize';

function parseJsonIfString(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function normalizePathData(rawPathData: unknown): Record<string, unknown> | null {
  const data = parseJsonIfString(rawPathData);
  if (typeof data === 'string') return null;
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  if (Array.isArray(data)) {
    return { path: data };
  }
  return null;
}

function readLatLng(record: Record<string, unknown>): { lat: number; lng: number } | null {
  const lat = Number(record.lat);
  const lng = Number(record.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return null;
}

/** 등록 시 저장된 출발지 (`points` 또는 `waypoint_points`) — 상세 지도와 동일 규칙 */
function extractWaypointStartLatLng(rawPathData: unknown): { lat: number; lng: number } | null {
  const pathData = normalizePathData(rawPathData);
  if (!pathData) return null;

  const pts = pathData.points;
  const wps = pathData.waypoint_points;
  const rawPoints =
    (Array.isArray(pts) && pts.length > 0 ? pts : null) ??
    (Array.isArray(wps) && wps.length > 0 ? wps : null);

  if (!rawPoints?.length) return null;

  const startByRole = rawPoints.find((item) => {
    if (typeof item !== 'object' || item === null) return false;
    const role = String((item as Record<string, unknown>).role ?? '').toLowerCase();
    return role === 'start';
  });

  const chosen = startByRole ?? rawPoints[0];
  if (typeof chosen !== 'object' || chosen === null) return null;
  return readLatLng(chosen as Record<string, unknown>);
}

/** 보행 경로 첫 좌표 (`path` 배열) — 웨이포인트가 없을 때 보조 */
function extractPathFirstLatLng(rawPathData: unknown): { lat: number; lng: number } | null {
  const pathData = normalizePathData(rawPathData);
  if (!pathData) return null;
  const path = pathData.path;
  if (!Array.isArray(path) || path.length === 0) return null;

  const first = path[0];
  if (typeof first === 'object' && first !== null && !Array.isArray(first)) {
    const pair = readLatLng(first as Record<string, unknown>);
    if (pair) return pair;
  }

  if (Array.isArray(first) && first.length >= 2) {
    const a = Number(first[0]);
    const b = Number(first[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return { lat: a, lng: b };
    if (Math.abs(b) <= 90 && Math.abs(a) <= 180) return { lat: b, lng: a };
  }

  return null;
}

/** Tmap 마커에 올릴 코스 시작점 — 웨이포인트 시작 → 경로 첫점 → DB 컬럼 순 */
export function resolveRouteStartForMapMarker(route: Route): { lat: number; lng: number } | null {
  const fromWaypoint = extractWaypointStartLatLng(route.path_data);
  if (fromWaypoint) {
    return normalizeRouteStartForTmapMarker(fromWaypoint.lat, fromWaypoint.lng);
  }

  const fromPath = extractPathFirstLatLng(route.path_data);
  if (fromPath) {
    return normalizeRouteStartForTmapMarker(fromPath.lat, fromPath.lng);
  }

  return normalizeRouteStartForTmapMarker(route.start_lat, route.start_lng);
}
