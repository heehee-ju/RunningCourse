/**
 * Tmap 마커·LatLng용 저장 좌표 정규화 (EPSG:3857 미터값 역변환, lat/lng 순서 보정).
 */
import { isValidCoordinate } from '@/commons/utils/geo';

const WEB_MERCATOR_HALF = 20037508.34;

/** Web Mercator 동쪽·북쪽 미터 → WGS84 (위도·경도 도 단위). x=easting, y=northing */
export function webMercatorMetersToWgs84(x: number, y: number): { lat: number; lng: number } {
  const lng = (x / WEB_MERCATOR_HALF) * 180;
  const projectedLat = (y / WEB_MERCATOR_HALF) * 180;
  const lat =
    (180 / Math.PI) * (2 * Math.atan(Math.exp((projectedLat * Math.PI) / 180)) - Math.PI / 2);
  return { lat, lng };
}

function looksLikeWebMercatorMeters(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const insideExtent = Math.abs(a) <= WEB_MERCATOR_HALF && Math.abs(b) <= WEB_MERCATOR_HALF;
  /* 도 단위 위경도와 구분: 미터값은 한반도 부근에서 보통 둘 다 5e5 초과 */
  const magnitudeLikeProjected = Math.abs(a) > 500_000 && Math.abs(b) > 500_000;
  return insideExtent && magnitudeLikeProjected;
}

/**
 * DB `start_lat` / `start_lng` 필드를 Tmap `LatLng(lat, lng)`와 동일한 WGS84로 맞춘다.
 * - 정상 WGS84(lat, lng): 그대로
 * - EPSG:3857 미터가 컬럼에 들어간 경우: 역투영
 * - 필드명은 lat/lng인데 값만 뒤바뀐 경우: 교환 후 유효하면 적용
 */
export function normalizeRouteStartForTmapMarker(
  startLatField: number,
  startLngField: number,
): { lat: number; lng: number } | null {
  if (!Number.isFinite(startLatField) || !Number.isFinite(startLngField)) return null;

  if (isValidCoordinate(startLatField, startLngField)) {
    return { lat: startLatField, lng: startLngField };
  }

  if (looksLikeWebMercatorMeters(startLatField, startLngField)) {
    return webMercatorMetersToWgs84(startLatField, startLngField);
  }

  if (isValidCoordinate(startLngField, startLatField)) {
    return { lat: startLngField, lng: startLatField };
  }

  return null;
}
