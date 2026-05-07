'use client';

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import type { RouteViewport } from '@/commons/types/runroute';

import { HOME_QUERY_KEYS, HOME_SESSION_KEYS, TAB_ITEMS } from '../utils/home-constants';
import { isValidRouteViewport } from '../utils/viewport';

import type { DistanceCategory } from '../utils/course-filter';
import type { ReadonlyURLSearchParams } from 'next/navigation';

type UseHomeUrlSyncParams = {
  searchParams: ReadonlyURLSearchParams | null;
  pathname: string;
  router: { replace: (href: string, options?: { scroll?: boolean }) => void };
  selectedCourseId: string | null;
  selectedCategories: Set<DistanceCategory>;
  isSheetExpanded: boolean;
  setSelectedCourseId: Dispatch<SetStateAction<string | null>>;
  setSelectedCategories: Dispatch<SetStateAction<Set<DistanceCategory>>>;
  setIsSheetExpanded: Dispatch<SetStateAction<boolean>>;
  setVisibleRouteViewport: Dispatch<SetStateAction<RouteViewport | null>>;
  setFrozenVisibleRouteViewport: Dispatch<SetStateAction<RouteViewport | null>>;
  setRestoredInitialViewport: Dispatch<SetStateAction<RouteViewport | null>>;
  setMarkerClickRecenterToken: Dispatch<SetStateAction<number>>;
  visibleRouteViewport: RouteViewport | null;
  effectiveQueryViewport: RouteViewport | null;
  frozenVisibleRouteViewport: RouteViewport | null;
};

/** 쿼리·세션 복원, URL 동기화, 상세 진입 전 히스토리 스냅샷 */
export function useHomeUrlSync({
  searchParams,
  pathname,
  router,
  selectedCourseId,
  selectedCategories,
  isSheetExpanded,
  setSelectedCourseId,
  setSelectedCategories,
  setIsSheetExpanded,
  setVisibleRouteViewport,
  setFrozenVisibleRouteViewport,
  setRestoredInitialViewport,
  setMarkerClickRecenterToken,
  visibleRouteViewport,
  effectiveQueryViewport,
  frozenVisibleRouteViewport,
}: UseHomeUrlSyncParams) {
  const hasRestoredFromQueryRef = useRef(false);
  const lastSyncedQueryRef = useRef('');

  useEffect(() => {
    if (hasRestoredFromQueryRef.current) return;
    const selectedCourseFromQuery = searchParams?.get(HOME_QUERY_KEYS.selectedCourseId) ?? null;
    const categoriesFromQuery = searchParams?.get(HOME_QUERY_KEYS.categories) ?? null;
    const sheetFromQuery = searchParams?.get(HOME_QUERY_KEYS.sheet) ?? null;
    if (selectedCourseFromQuery) {
      setSelectedCourseId(selectedCourseFromQuery);
    }
    if (categoriesFromQuery) {
      const categorySet = new Set<DistanceCategory>();
      categoriesFromQuery.split(',').forEach((category) => {
        if (TAB_ITEMS.some((item) => item.category === category)) {
          categorySet.add(category as DistanceCategory);
        }
      });
      setSelectedCategories(categorySet);
    }
    if (sheetFromQuery === 'expanded') {
      setIsSheetExpanded(true);
    }
    const shouldRestoreViewport = typeof window !== 'undefined';

    if (shouldRestoreViewport) {
      const shouldRestoreOnce =
        window.sessionStorage.getItem(HOME_SESSION_KEYS.restoreViewportOnce) === '1';
      const shouldRestoreSelectedFocusOnce =
        window.sessionStorage.getItem(HOME_SESSION_KEYS.restoreSelectedFocusOnce) === '1';
      if (shouldRestoreOnce) {
        const rawViewport = window.sessionStorage.getItem(HOME_SESSION_KEYS.savedViewport);
        if (rawViewport) {
          try {
            const parsed = JSON.parse(rawViewport) as RouteViewport;
            if (isValidRouteViewport(parsed)) {
              setVisibleRouteViewport(parsed);
              setFrozenVisibleRouteViewport(parsed);
              setRestoredInitialViewport(parsed);
            }
          } catch {
            // 손상된 저장값은 무시
          }
        }
      }
      if (selectedCourseFromQuery && shouldRestoreSelectedFocusOnce) {
        setMarkerClickRecenterToken((prev) => prev + 1);
      }
      window.sessionStorage.removeItem(HOME_SESSION_KEYS.restoreViewportOnce);
      window.sessionStorage.removeItem(HOME_SESSION_KEYS.restoreSelectedFocusOnce);
    }
    hasRestoredFromQueryRef.current = true;
  }, [
    searchParams,
    setFrozenVisibleRouteViewport,
    setIsSheetExpanded,
    setMarkerClickRecenterToken,
    setRestoredInitialViewport,
    setSelectedCategories,
    setSelectedCourseId,
    setVisibleRouteViewport,
  ]);

  useEffect(() => {
    if (!hasRestoredFromQueryRef.current) return;

    const params = new URLSearchParams();
    if (selectedCourseId) {
      params.set(HOME_QUERY_KEYS.selectedCourseId, selectedCourseId);
    }
    if (selectedCategories.size > 0) {
      const encodedCategories = TAB_ITEMS.map((item) => item.category).filter((category) =>
        selectedCategories.has(category),
      );
      params.set(HOME_QUERY_KEYS.categories, encodedCategories.join(','));
    }
    if (isSheetExpanded) {
      params.set(HOME_QUERY_KEYS.sheet, 'expanded');
    }
    const nextQuery = params.toString();
    const currentQuery = searchParams?.toString() ?? '';
    if (nextQuery === currentQuery) {
      lastSyncedQueryRef.current = nextQuery;
      return;
    }
    if (lastSyncedQueryRef.current === nextQuery) return;
    lastSyncedQueryRef.current = nextQuery;
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [isSheetExpanded, pathname, router, searchParams, selectedCategories, selectedCourseId]);

  const snapshotHomeQueryBeforeDetail = useCallback(
    (courseId: string) => {
      if (typeof window === 'undefined') return;

      const params = new URLSearchParams();
      params.set(HOME_QUERY_KEYS.selectedCourseId, courseId);
      window.sessionStorage.setItem(HOME_SESSION_KEYS.restoreSelectedFocusOnce, '1');

      if (selectedCategories.size > 0) {
        const encodedCategories = TAB_ITEMS.map((item) => item.category).filter((category) =>
          selectedCategories.has(category),
        );
        params.set(HOME_QUERY_KEYS.categories, encodedCategories.join(','));
      }

      if (isSheetExpanded) {
        params.set(HOME_QUERY_KEYS.sheet, 'expanded');
      }

      const viewportForSnapshot =
        visibleRouteViewport ?? effectiveQueryViewport ?? frozenVisibleRouteViewport;
      if (isValidRouteViewport(viewportForSnapshot)) {
        window.sessionStorage.setItem(
          HOME_SESSION_KEYS.savedViewport,
          JSON.stringify(viewportForSnapshot),
        );
        window.sessionStorage.setItem(HOME_SESSION_KEYS.restoreViewportOnce, '1');
      } else {
        const hasSavedViewport = Boolean(
          window.sessionStorage.getItem(HOME_SESSION_KEYS.savedViewport),
        );
        if (hasSavedViewport) {
          window.sessionStorage.setItem(HOME_SESSION_KEYS.restoreViewportOnce, '1');
        } else {
          window.sessionStorage.removeItem(HOME_SESSION_KEYS.restoreViewportOnce);
        }
      }

      const nextQuery = params.toString();
      const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (currentUrl === nextUrl) return;

      window.history.replaceState(window.history.state, '', nextUrl);
      lastSyncedQueryRef.current = nextQuery;
    },
    [
      effectiveQueryViewport,
      frozenVisibleRouteViewport,
      isSheetExpanded,
      pathname,
      selectedCategories,
      visibleRouteViewport,
    ],
  );

  return { snapshotHomeQueryBeforeDetail };
}
