// 홈 페이지 지도용 코스 비즈니스 로직
import type { Route, RouteViewport } from '@/commons/types/routerun';
import { getHomeRoutesByViewport } from '@/repositories/course/home.repository';

export async function fetchHomeRoutes(viewport: RouteViewport): Promise<Route[]> {
  return getHomeRoutesByViewport(viewport);
}
