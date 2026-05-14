import type { RouteViewport } from '@/commons/types/routerun';

type PixelLatLng = { lat: number; lng: number };

function pixelToLatLngLinear(
  px: number,
  py: number,
  mapWidthPx: number,
  mapHeightPx: number,
  northEastLat: number,
  northEastLng: number,
  southWestLat: number,
  southWestLng: number,
): PixelLatLng {
  const lat = northEastLat + (py / mapHeightPx) * (southWestLat - northEastLat);
  const lng = southWestLng + (px / mapWidthPx) * (northEastLng - southWestLng);
  return { lat, lng };
}

/**
 * 하단이 오버레이로 가려질 때, 상단에 남는 직사각형 영역의 위경도 bounding box.
 * getBounds() 전체와 픽셀 대응으로 네 모서리를 구한 뒤 min/max로 RouteViewport를 만든다.
 */
export function computeVisibleRouteViewportFromMapCanvas(params: {
  northEastLat: number;
  northEastLng: number;
  southWestLat: number;
  southWestLng: number;
  mapWidthPx: number;
  mapHeightPx: number;
  bottomOverlayPx: number;
}): RouteViewport | null {
  const {
    northEastLat,
    northEastLng,
    southWestLat,
    southWestLng,
    mapWidthPx,
    mapHeightPx,
    bottomOverlayPx,
  } = params;

  if (
    !Number.isFinite(mapWidthPx) ||
    !Number.isFinite(mapHeightPx) ||
    mapWidthPx <= 0 ||
    mapHeightPx <= 0
  ) {
    return null;
  }

  const overlay = Math.min(Math.max(0, bottomOverlayPx), mapHeightPx);
  const visibleBottomY = Math.max(0, mapHeightPx - overlay);

  const corners: PixelLatLng[] = [
    pixelToLatLngLinear(
      0,
      0,
      mapWidthPx,
      mapHeightPx,
      northEastLat,
      northEastLng,
      southWestLat,
      southWestLng,
    ),
    pixelToLatLngLinear(
      mapWidthPx,
      0,
      mapWidthPx,
      mapHeightPx,
      northEastLat,
      northEastLng,
      southWestLat,
      southWestLng,
    ),
    pixelToLatLngLinear(
      0,
      visibleBottomY,
      mapWidthPx,
      mapHeightPx,
      northEastLat,
      northEastLng,
      southWestLat,
      southWestLng,
    ),
    pixelToLatLngLinear(
      mapWidthPx,
      visibleBottomY,
      mapWidthPx,
      mapHeightPx,
      northEastLat,
      northEastLng,
      southWestLat,
      southWestLng,
    ),
  ];

  const lats = corners.map((c) => c.lat);
  const lngs = corners.map((c) => c.lng);

  return {
    northEastLat: Math.max(...lats),
    southWestLat: Math.min(...lats),
    northEastLng: Math.max(...lngs),
    southWestLng: Math.min(...lngs),
  };
}
