'use client';

import { useEffect, useMemo, useState } from 'react';

import type { Route, RouteViewport } from '@/commons/types/routerun';
import { fetchHomeRoutes } from '@/services/course/homeCourseService';

type UseRoutesResult = {
  /** 뷰포트(bounds) 안에 시작점이 있는 코스만 */
  routes: Route[];
  /** 뷰포트 필터 없이 전체(선택 유지·오버레이용) */
  allRoutes: Route[];
  isLoading: boolean;
  errorMessage: string | null;
};

const homeRoutesViewportCache = new Map<string, Route[]>();

function toViewportCacheKey(viewport: RouteViewport): string {
  return [
    viewport.northEastLat.toFixed(6),
    viewport.northEastLng.toFixed(6),
    viewport.southWestLat.toFixed(6),
    viewport.southWestLng.toFixed(6),
  ].join(',');
}

export function useRoutes(viewport: RouteViewport | null): UseRoutesResult {
  const [allRoutes, setAllRoutes] = useState<Route[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!viewport) {
      setAllRoutes([]);
      setIsLoading(false);
      setErrorMessage(null);
      return () => {
        isMounted = false;
      };
    }

    const values = [
      viewport.northEastLat,
      viewport.northEastLng,
      viewport.southWestLat,
      viewport.southWestLng,
    ];
    const hasInvalidViewport = values.some((value) => !Number.isFinite(value));
    if (hasInvalidViewport) {
      setAllRoutes([]);
      setIsLoading(false);
      setErrorMessage(null);
      return () => {
        isMounted = false;
      };
    }

    // [조회] 코스 목록 요청 및 상태 갱신 처리 (home 전용 데이터 통신은 repositories/services에서 처리)
    const loadRoutes = async () => {
      const cacheKey = toViewportCacheKey(viewport);
      const cached = homeRoutesViewportCache.get(cacheKey);
      if (cached) {
        setAllRoutes(cached);
        setIsLoading(false);
        setErrorMessage(null);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const routes = await fetchHomeRoutes(viewport);

        if (!isMounted) return;

        homeRoutesViewportCache.set(cacheKey, routes);
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
  }, [viewport]);

  const routes = useMemo(() => allRoutes, [allRoutes]);

  return { routes, allRoutes, isLoading, errorMessage };
}
