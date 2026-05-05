'use client';

import { useEffect, useMemo, useState } from 'react';

import type { Route, RouteViewport } from '@/commons/types/runroute';
import { fetchHomeRoutes } from '@/services/course/homeCourseService';

type UseRoutesResult = {
  /** 뷰포트(bounds) 안에 시작점이 있는 코스만 */
  routes: Route[];
  /** 뷰포트 필터 없이 전체(선택 유지·오버레이용) */
  allRoutes: Route[];
  isLoading: boolean;
  errorMessage: string | null;
};

export function useRoutes(viewport: RouteViewport | null): UseRoutesResult {
  const [allRoutes, setAllRoutes] = useState<Route[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    // [조회] 코스 목록 요청 및 상태 갱신 처리 (home 전용 데이터 통신은 repositories/services에서 처리)
    const loadRoutes = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const routes = await fetchHomeRoutes();

        if (!isMounted) return;

        setAllRoutes(routes);
      } catch (error) {
        // [오류] 조회 실패 메시지 상태 반영
        if (!isMounted) return;
        console.error('코스 조회 실패:', error);
        setErrorMessage('코스 정보를 불러오지 못했습니다.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadRoutes();

    return () => {
      // [정리] 언마운트 이후 상태 업데이트 방지
      isMounted = false;
    };
  }, []);

  const routes = useMemo(() => {
    if (!viewport) {
      return allRoutes;
    }

    const { northEastLat, northEastLng, southWestLat, southWestLng } = viewport;
    const values = [northEastLat, northEastLng, southWestLat, southWestLng];
    const hasInvalidViewport = values.some((value) => !Number.isFinite(value));
    if (hasInvalidViewport) {
      return allRoutes;
    }

    // SDK/브라우저 조합에 따라 bounds 축이 역전되어 들어오는 케이스를 보정한다.
    const minLat = Math.min(northEastLat, southWestLat);
    const maxLat = Math.max(northEastLat, southWestLat);
    const minLng = Math.min(northEastLng, southWestLng);
    const maxLng = Math.max(northEastLng, southWestLng);

    return allRoutes.filter((route) => {
      return (
        route.start_lat >= minLat &&
        route.start_lat <= maxLat &&
        route.start_lng >= minLng &&
        route.start_lng <= maxLng
      );
    });
  }, [allRoutes, viewport]);

  return { routes, allRoutes, isLoading, errorMessage };
}
