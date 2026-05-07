'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';

import { Icon } from '@/commons/components/icons';
import { TabButton } from '@/commons/components/tab';
import { ROUTES } from '@/commons/constants/url';
import { useCourseLikes } from '@/commons/hooks/useCourseLikes';
import { Header } from '@/commons/layout/header';
import type { RouteViewport } from '@/commons/types/runroute';
import { CoursesList } from '@/components/courses-list';
import { TmapHome } from '@/components/tmap/home';

import { useRoutes } from './hooks/index.use-routes';
import { useHomeFrozenViewportSync } from './hooks/use-home-frozen-viewport';
import { useHomeToast } from './hooks/use-home-toast';
import { useHomeUrlSync } from './hooks/use-home-url-sync';
import { useHomeVisibleRouteViewport } from './hooks/use-home-visible-viewport';
import { useReferenceLocation } from './hooks/use-reference-location';
import styles from './styles.module.css';
import { buildCourseCardViews, type DistanceCategory } from './utils/course-filter';
import { TAB_ITEMS } from './utils/home-constants';
import {
  computeFilteredRoutesForHome,
  computeRoutesForCourseListForHome,
} from './utils/home-route-derivations';

export function Home() {
  const [sheetVisibleHeight, setSheetVisibleHeight] = useState(260);
  const sheetVisibleHeightRef = useRef(sheetVisibleHeight);
  sheetVisibleHeightRef.current = sheetVisibleHeight;
  const [openPeekFromCollapsedSignal, setOpenPeekFromCollapsedSignal] = useState(0);
  const [markerClickRecenterToken, setMarkerClickRecenterToken] = useState(0);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<DistanceCategory>>(new Set());
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [mapMoveSignal, setMapMoveSignal] = useState(0);
  const [visibleRouteViewport, setVisibleRouteViewport] = useState<RouteViewport | null>(null);
  const [frozenVisibleRouteViewport, setFrozenVisibleRouteViewport] =
    useState<RouteViewport | null>(null);
  const [restoredInitialViewport, setRestoredInitialViewport] = useState<RouteViewport | null>(
    null,
  );
  const referenceLocation = useReferenceLocation();

  const effectiveQueryViewport = isSheetExpanded
    ? frozenVisibleRouteViewport
    : visibleRouteViewport;
  const { routes, allRoutes, isLoading, errorMessage } = useRoutes(effectiveQueryViewport);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { homeToast, handleZoomLimitReached, handleZoomLimitCleared } = useHomeToast({
    mapMoveSignal,
    routesLength: routes.length,
    isLoading,
    errorMessage,
  });

  const handleMapDragSettled = useCallback(() => {
    setMapMoveSignal((previous) => previous + 1);
  }, []);

  const handleViewportChanged = useCallback(() => {}, []);

  const handleVisibleRouteViewportChanged = useHomeVisibleRouteViewport(setVisibleRouteViewport);

  useHomeFrozenViewportSync({
    isSheetExpanded,
    visibleRouteViewport,
    setFrozenVisibleRouteViewport,
  });

  const { snapshotHomeQueryBeforeDetail } = useHomeUrlSync({
    searchParams,
    pathname: pathname ?? '',
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
  });

  const filteredRoutes = useMemo(
    () => computeFilteredRoutesForHome(routes, selectedCategories, selectedCourseId, allRoutes),
    [routes, selectedCategories, selectedCourseId, allRoutes],
  );

  const routesForCourseList = useMemo(
    () =>
      computeRoutesForCourseListForHome(
        filteredRoutes,
        effectiveQueryViewport,
        selectedCourseId,
        allRoutes,
      ),
    [allRoutes, effectiveQueryViewport, filteredRoutes, selectedCourseId],
  );

  const courseCards = useMemo(
    () => buildCourseCardViews(routesForCourseList, referenceLocation, selectedCourseId),
    [routesForCourseList, referenceLocation, selectedCourseId],
  );

  const courseLikeCounts = useMemo(
    () =>
      allRoutes.reduce<Record<string, number>>((acc, route) => {
        acc[route.id] = route.likes_count;
        return acc;
      }, {}),
    [allRoutes],
  );
  const { isCourseLiked, getCourseLikeCount } = useCourseLikes(courseLikeCounts);

  const toggleCategory = (category: DistanceCategory) => {
    setSelectedCategories((previous) => {
      const next = new Set(previous);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleCourseMarkerClick = useCallback((courseId: string) => {
    setSelectedCourseId(courseId);
    setMarkerClickRecenterToken((previous) => previous + 1);
    if (sheetVisibleHeightRef.current <= 24) {
      setOpenPeekFromCollapsedSignal((previous) => previous + 1);
    }
  }, []);

  return (
    <section className={styles.container}>
      <div className={styles.topChrome}>
        <Header showLogo showLeftIcon={false} showRightIcon={false} title="루트런" />
      </div>
      <div className={styles.tab}>
        <div className={styles.tabScroll}>
          {TAB_ITEMS.map((tab) => (
            <div key={tab.label} className={styles.tabItem}>
              <TabButton
                variant={tab.variant}
                isActive={selectedCategories.has(tab.category)}
                onClick={() => toggleCategory(tab.category)}
              >
                {tab.label}
              </TabButton>
            </div>
          ))}
        </div>
      </div>

      {errorMessage ? (
        <p role="status" className={styles.errorMessage}>
          {errorMessage}
        </p>
      ) : null}

      <div className={styles.mapStage}>
        <div className={styles.map}>
          <TmapHome
            bottomSheetVisibleHeight={sheetVisibleHeight}
            isBottomSheetExpanded={isSheetExpanded}
            routes={filteredRoutes}
            initialViewport={restoredInitialViewport}
            selectedCourseId={selectedCourseId}
            markerClickRecenterToken={markerClickRecenterToken}
            onCourseMarkerClick={handleCourseMarkerClick}
            onViewportChanged={handleViewportChanged}
            onVisibleViewportChanged={handleVisibleRouteViewportChanged}
            onZoomLimitReached={handleZoomLimitReached}
            onZoomLimitCleared={handleZoomLimitCleared}
            onDragSettled={handleMapDragSettled}
          />
        </div>
        {homeToast ? (
          <div className={styles.noCourseToastLayer} aria-live="polite">
            <div className={styles.noCourseToast}>
              <span className={styles.noCourseToastIcon}>
                <Icon name="circleAlert" size={16} strokeWidth={2} />
              </span>
              <span>{homeToast.message}</span>
            </div>
          </div>
        ) : null}
        <CoursesList
          cards={courseCards}
          isLoading={isLoading}
          isCourseLiked={isCourseLiked}
          getCourseLikeCount={getCourseLikeCount}
          openPeekFromCollapsedSignal={openPeekFromCollapsedSignal}
          onCourseSelect={(courseId) => {
            setSelectedCourseId(courseId);
            snapshotHomeQueryBeforeDetail(courseId);
            router.push(ROUTES.COURSES.DETAIL(courseId));
          }}
          onSheetPositionChange={({ state, visibleHeight }) => {
            setIsSheetExpanded(state === 'expanded');
            setSheetVisibleHeight(visibleHeight);
          }}
        />
      </div>
    </section>
  );
}

export default Home;
