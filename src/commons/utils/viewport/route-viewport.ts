import type { RouteViewport } from '@/commons/types/routerun';

export function isValidRouteViewport(viewport: RouteViewport | null): viewport is RouteViewport {
  if (!viewport) return false;
  return (
    Number.isFinite(viewport.northEastLat) &&
    Number.isFinite(viewport.northEastLng) &&
    Number.isFinite(viewport.southWestLat) &&
    Number.isFinite(viewport.southWestLng)
  );
}

export function isSameRouteViewport(
  left: RouteViewport | null,
  right: RouteViewport | null,
): boolean {
  if (!left || !right) return false;
  return (
    left.northEastLat === right.northEastLat &&
    left.northEastLng === right.northEastLng &&
    left.southWestLat === right.southWestLat &&
    left.southWestLng === right.southWestLng
  );
}
