'use client';

// 홈 URL 쿼리·sessionStorage와 선택 상태 동기화, 상세 진입 전 히스토리 스냅샷을 담당한다.

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import { HOME_QUERY_KEYS, HOME_SESSION_KEYS, TAB_ITEMS } from '@/commons/constants/home';
import type { RouteViewport } from '@/commons/types/routerun';
import type { DistanceCategory } from '@/commons/utils/distance/category';
import { isValidRouteViewport } from '@/commons/utils/viewport/route-viewport';

import {
  areDistanceCategorySetsEqual,
  parseDistanceCategoriesFromQuery,
  resolveHomeSearchParamsForRead,
} from '../utils/home-url-sync-helpers';

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

/** 쿼리·세션 복원, URL 동기화, 상세 진입 전 히스토리 스냅샷 (순수 로직은 `home-url-sync-helpers`) */
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
  const lastSyncedQueryRef = useRef('');
  /** URL에서 홈 UI 상태를 한 번 이상 읽은 뒤에만 state→URL replace를 허용 (초기 레이스 완화) */
  const allowStateToUrlSyncRef = useRef(false);
  /** `restoreViewportOnce` 세션을 이미 처리했는지 (뷰포트 JSON은 1회만 적용) */
  const didApplyViewportFromSessionRef = useRef(false);

  /**
   * URL(Next + window 보강)과 세션 플래그에서 홈 상태를 복구한다.
   * - 예전 `hasRestoredFromQueryRef` 한 방에 막아 두면 searchParams가 늦게 채워질 때 영구히 놓친다.
   * - 코스 id는 쿼리에 있을 때만 반영하고, 쿼리에서 사라졌다고 로컬 선택을 지우지는 않는다.
   *   (마커 선택 직후 아직 router.replace 전 한 틱과의 충돌 방지)
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const merged = resolveHomeSearchParamsForRead(pathname, searchParams);
    const rawCourseId = merged.get(HOME_QUERY_KEYS.selectedCourseId);
    const courseIdFromUrl = rawCourseId?.trim() ? rawCourseId.trim() : null;

    if (courseIdFromUrl) {
      setSelectedCourseId((previous) =>
        previous === courseIdFromUrl ? previous : courseIdFromUrl,
      );
    }

    const categoriesRaw = merged.get(HOME_QUERY_KEYS.categories);
    if (categoriesRaw) {
      const parsed = parseDistanceCategoriesFromQuery(categoriesRaw);
      setSelectedCategories((previous) =>
        areDistanceCategorySetsEqual(previous, parsed) ? previous : parsed,
      );
    }

    if (merged.get(HOME_QUERY_KEYS.sheet) === 'expanded') {
      setIsSheetExpanded((previous) => (previous ? previous : true));
    }

    const shouldRestoreViewportOnce =
      window.sessionStorage.getItem(HOME_SESSION_KEYS.restoreViewportOnce) === '1';
    if (shouldRestoreViewportOnce && !didApplyViewportFromSessionRef.current) {
      didApplyViewportFromSessionRef.current = true;
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
      window.sessionStorage.removeItem(HOME_SESSION_KEYS.restoreViewportOnce);
    }

    const shouldRestoreSelectedFocusOnce =
      window.sessionStorage.getItem(HOME_SESSION_KEYS.restoreSelectedFocusOnce) === '1';
    if (shouldRestoreSelectedFocusOnce && courseIdFromUrl) {
      setMarkerClickRecenterToken((previous) => previous + 1);
      window.sessionStorage.removeItem(HOME_SESSION_KEYS.restoreSelectedFocusOnce);
    }

    allowStateToUrlSyncRef.current = true;
  }, [
    pathname,
    searchParams,
    setFrozenVisibleRouteViewport,
    setIsSheetExpanded,
    setMarkerClickRecenterToken,
    setRestoredInitialViewport,
    setSelectedCategories,
    setSelectedCourseId,
    setVisibleRouteViewport,
  ]);

  /** 로컬 상태를 쿼리스트링에 맞춘다. (URL이 이미 같으면 replace 생략) */
  useEffect(() => {
    if (!allowStateToUrlSyncRef.current) return;

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
      if (currentUrl === nextUrl) {
        // URL은 이미 동기화된 상태여도, 상세 복귀 시 포커스/뷰포트 복원을 위해 세션은 반드시 갱신한다.
        lastSyncedQueryRef.current = nextQuery;
        return;
      }

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
