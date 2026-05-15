'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';

import { Icon } from '@/commons/components/icons';
import { TabButton } from '@/commons/components/tab';
import { TAB_ITEMS } from '@/commons/constants/home';
import { ROUTES } from '@/commons/constants/url';
import { useCourseLikes } from '@/commons/hooks/useCourseLikes';
import { Header } from '@/commons/layout/header';
import { Sidebar } from '@/commons/layout/sidebar';
import type { Route, RouteViewport } from '@/commons/types/routerun';
import { CoursesList } from '@/components/courses-list';
import { TmapHome } from '@/components/tmap/home';

import { useRoutes } from './hooks/index.use-routes';
import { useClearSelectedRouteSnapshotOnDeselect } from './hooks/use-clear-selected-route-snapshot';
import { useHomeCourseMarkerClick } from './hooks/use-home-course-marker-click';
import { useHomeDistanceCategories } from './hooks/use-home-distance-categories';
import { useHomeFrozenViewportSync } from './hooks/use-home-frozen-viewport';
import { useHomeToast } from './hooks/use-home-toast';
import { useHomeUrlSync } from './hooks/use-home-url-sync';
import { useHomeVisibleRouteViewport } from './hooks/use-home-visible-viewport';
import { useReferenceLocation } from './hooks/use-reference-location';
import { OnboardingModal } from './onboarding-modal';
import styles from './styles.module.css';
import { buildCourseCardViews } from './utils/course-filter';
import { buildCourseLikeCountsLookup } from './utils/home-like-counts';
import {
  computeFilteredRoutesForHome,
  computeRoutesForCourseListForHome,
} from './utils/home-route-derivations';

export function Home() {
  const [isHomeMenuOpen, setIsHomeMenuOpen] = useState(false);
  const [sheetVisibleHeight, setSheetVisibleHeight] = useState(260);
  const [sheetVisualVisibleHeight, setSheetVisualVisibleHeight] = useState(260);
  const sheetVisibleHeightRef = useRef(sheetVisibleHeight);
  sheetVisibleHeightRef.current = sheetVisibleHeight;
  const [openPeekFromCollapsedSignal, setOpenPeekFromCollapsedSignal] = useState(0);
  const [markerClickRecenterToken, setMarkerClickRecenterToken] = useState(0);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const { selectedCategories, setSelectedCategories, toggleCategory } = useHomeDistanceCategories();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  /** 뷰포트 밖으로 이동해도 선택 코스를 목록·지도에 유지 (조회 결과 우선, 없을 때만 사용) */
  const [selectedRouteSnapshot, setSelectedRouteSnapshot] = useState<Route | null>(null);
  const [visibleRouteViewport, setVisibleRouteViewport] = useState<RouteViewport | null>(null);
  const [frozenVisibleRouteViewport, setFrozenVisibleRouteViewport] =
    useState<RouteViewport | null>(null);
  const [restoredInitialViewport, setRestoredInitialViewport] = useState<RouteViewport | null>(
    null,
  );
  const referenceLocation = useReferenceLocation();

  // 펼침 직후 frozen이 아직 없을 때(드래그 등) null로 코스가 비지 않도록 visible로 이어 붙임
  const effectiveQueryViewport = isSheetExpanded
    ? (frozenVisibleRouteViewport ?? visibleRouteViewport)
    : visibleRouteViewport;
  const { routes, allRoutes, isLoading, errorMessage } = useRoutes(effectiveQueryViewport);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { homeToast, isHomeToastFadingOut, handleZoomLimitReached, handleZoomLimitCleared } =
    useHomeToast({
      queryViewport: effectiveQueryViewport,
      routesLength: routes.length,
      isLoading,
      errorMessage,
    });

  const handleVisibleRouteViewportChanged = useHomeVisibleRouteViewport(setVisibleRouteViewport);

  useHomeFrozenViewportSync({
    isSheetExpanded,
    visibleRouteViewport,
    setFrozenVisibleRouteViewport,
  });

  useClearSelectedRouteSnapshotOnDeselect(selectedCourseId, setSelectedRouteSnapshot);

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
    () =>
      computeFilteredRoutesForHome(
        routes,
        selectedCategories,
        selectedCourseId,
        allRoutes,
        selectedRouteSnapshot,
      ),
    [allRoutes, routes, selectedCategories, selectedCourseId, selectedRouteSnapshot],
  );

  const routesForCourseList = useMemo(
    () =>
      computeRoutesForCourseListForHome(
        filteredRoutes,
        effectiveQueryViewport,
        selectedCourseId,
        allRoutes,
        selectedRouteSnapshot,
      ),
    [allRoutes, effectiveQueryViewport, filteredRoutes, selectedCourseId, selectedRouteSnapshot],
  );

  const courseCards = useMemo(
    () => buildCourseCardViews(routesForCourseList, referenceLocation, selectedCourseId),
    [routesForCourseList, referenceLocation, selectedCourseId],
  );

  const courseLikeCounts = useMemo(
    () => buildCourseLikeCountsLookup(allRoutes, selectedCourseId, selectedRouteSnapshot),
    [allRoutes, selectedCourseId, selectedRouteSnapshot],
  );
  const { isCourseLiked, getCourseLikeCount } = useCourseLikes(courseLikeCounts);

  const handleCourseMarkerClick = useHomeCourseMarkerClick({
    collapsedPeekHeightThreshold: 24,
    sheetVisibleHeightRef,
    setSelectedCourseId,
    setSelectedRouteSnapshot,
    setMarkerClickRecenterToken,
    setOpenPeekFromCollapsedSignal,
  });

  return (
    <section className={styles.container}>
      <OnboardingModal />
      <div className={styles.topChrome}>
        <Header
          showLogo
          showLeftIcon={false}
          showRightIcon
          rightIconName="menu"
          rightIconAriaLabel="메뉴 열기"
          onRightIconClick={() => {
            setIsHomeMenuOpen(true);
          }}
          title="루트런"
        />
      </div>
      <Sidebar open={isHomeMenuOpen} onClose={() => setIsHomeMenuOpen(false)} />
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
            bottomSheetVisualVisibleHeight={sheetVisualVisibleHeight}
            isBottomSheetExpanded={isSheetExpanded}
            routes={filteredRoutes}
            initialViewport={restoredInitialViewport}
            selectedCourseId={selectedCourseId}
            markerClickRecenterToken={markerClickRecenterToken}
            onCourseMarkerClick={handleCourseMarkerClick}
            onVisibleViewportChanged={handleVisibleRouteViewportChanged}
            onZoomLimitReached={handleZoomLimitReached}
            onZoomLimitCleared={handleZoomLimitCleared}
          />
        </div>
        {homeToast ? (
          <div
            className={[
              styles.noCourseToastLayer,
              !isHomeToastFadingOut ? styles.noCourseToastLayerEnter : '',
              isHomeToastFadingOut ? styles.noCourseToastLayerLeaving : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-live="polite"
          >
            <div className={styles.noCourseToast}>
              <span className={styles.noCourseToastIcon}>
                <Icon name="circleAlert" size={16} />
              </span>
              <span>{homeToast.message}</span>
            </div>
          </div>
        ) : null}
        <CoursesList
          cards={courseCards}
          isLoading={isLoading}
          isRouteQueryViewportReady={effectiveQueryViewport !== null}
          isCourseLiked={isCourseLiked}
          getCourseLikeCount={getCourseLikeCount}
          openPeekFromCollapsedSignal={openPeekFromCollapsedSignal}
          onCourseSelect={(courseId) => {
            setSelectedCourseId(courseId);
            snapshotHomeQueryBeforeDetail(courseId);
            router.push(ROUTES.COURSES.DETAIL(courseId));
          }}
          onSheetPositionChange={({ state, visibleHeight, visualVisibleHeight }) => {
            setIsSheetExpanded(state === 'expanded');
            setSheetVisibleHeight(visibleHeight);
            setSheetVisualVisibleHeight(visualVisibleHeight);
          }}
        />
      </div>
    </section>
  );
}

export default Home;
