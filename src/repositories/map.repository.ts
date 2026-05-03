import type {
  TmapCoordinate,
  TmapPedestrianRouteFeature,
  TmapPedestrianRouteResponse,
} from '@/commons/types/tmap';
import { isValidCoordinate } from '@/commons/utils/geo';

const TMAP_PEDESTRIAN_ROUTE_URL = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1';

type ReverseGeocodingAddressInfo = {
  city_do?: string;
  gu_gun?: string;
};

type ReverseGeocodingResponse = {
  addressInfo?: ReverseGeocodingAddressInfo;
};

export type ReverseGeocodeRegionParams = {
  lat: number;
  lng: number;
  signal?: AbortSignal;
};

function formatRegionAddress(addressInfo?: ReverseGeocodingAddressInfo): string | null {
  if (!addressInfo) {
    return null;
  }

  const city = addressInfo.city_do?.trim() ?? '';
  const district = addressInfo.gu_gun?.trim() ?? '';
  const formatted = [city, district].filter(Boolean).join(' ');
  return formatted || null;
}

/**
 * 리버스 지오코딩(Tmap Geo Reverse Geocoding)으로 시/도 + 구/군 주소를 반환한다.
 * NOTE: 외부 통신은 repositories에서만 수행한다.
 */
export async function reverseGeocodeRegion({
  lat,
  lng,
  signal,
}: ReverseGeocodeRegionParams): Promise<string | null> {
  const appKey = process.env.NEXT_PUBLIC_TMAP_API_KEY;

  if (!isValidCoordinate(lat, lng) || !appKey?.trim()) {
    return null;
  }

  const searchParams = new URLSearchParams({
    version: '1',
    format: 'json',
    coordType: 'WGS84GEO',
    addressType: 'A10',
    lon: String(lng),
    lat: String(lat),
  });

  const response = await fetch(
    `https://apis.openapi.sk.com/tmap/geo/reversegeocoding?${searchParams.toString()}`,
    {
      method: 'GET',
      headers: {
        appKey,
      },
      signal,
    },
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as ReverseGeocodingResponse;
  return formatRegionAddress(data.addressInfo);
}

export type PedestrianRouteResult = {
  totalDistanceMeters: number;
  path: TmapCoordinate[];
};

/** 경유지가 있을 때만 반환. 빈 문자열을 넣으면 Tmap API가 400/1100(요청 데이터 오류)을 반환한다. */
function buildPassList(points: TmapCoordinate[]): string | undefined {
  if (points.length <= 2) return undefined;
  return points
    .slice(1, -1)
    .map((point) => `${point.lng},${point.lat}`)
    .join('_');
}

function parseLineStringCoordinates(feature: TmapPedestrianRouteFeature): TmapCoordinate[] {
  if (feature.geometry.type !== 'LineString') return [];

  return (feature.geometry.coordinates as number[][])
    .filter((coordinate) => coordinate.length >= 2)
    .map((coordinate) => ({
      lng: Number(coordinate[0]),
      lat: Number(coordinate[1]),
    }))
    .filter((coordinate) => Number.isFinite(coordinate.lat) && Number.isFinite(coordinate.lng));
}

/**
 * Tmap OpenAPI 보행자 경로 탐색 (`/tmap/routes/pedestrian`).
 * 등록 화면·코스 상세 미리보기에서 동일 스펙으로 도보 기반 라인을 맞춘다.
 */
export async function getPedestrianRoute(
  points: TmapCoordinate[],
  signal?: AbortSignal,
): Promise<PedestrianRouteResult> {
  if (points.length < 2) {
    throw new Error('보행자 경로 탐색은 최소 2개 좌표가 필요합니다.');
  }

  const appKey = process.env.NEXT_PUBLIC_TMAP_API_KEY;
  if (!appKey) {
    throw new Error('NEXT_PUBLIC_TMAP_API_KEY가 설정되지 않았습니다.');
  }

  const start = points[0];
  const end = points[points.length - 1];

  const passList = buildPassList(points);
  const requestBody: Record<string, string | number> = {
    startX: start.lng,
    startY: start.lat,
    endX: end.lng,
    endY: end.lat,
    reqCoordType: 'WGS84GEO',
    resCoordType: 'WGS84GEO',
    startName: '출발지',
    endName: '도착지',
  };
  if (passList) {
    requestBody.passList = passList;
  }

  const response = await fetch(TMAP_PEDESTRIAN_ROUTE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      appKey,
    },
    body: JSON.stringify(requestBody),
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Tmap 보행자 경로 조회 실패: ${response.status}`);
  }

  const data = (await response.json()) as TmapPedestrianRouteResponse;
  const path = data.features.flatMap(parseLineStringCoordinates);
  const totalDistanceMeters = data.features.reduce((distance, feature) => {
    if (typeof feature.properties.totalDistance === 'number') {
      return Math.max(distance, feature.properties.totalDistance);
    }
    return distance;
  }, 0);

  return { totalDistanceMeters, path };
}
