'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Icon } from '@/commons/components/icons';
import { TabButton } from '@/commons/components/tab';
import { ROUTES } from '@/commons/constants/url';
import { Header } from '@/commons/layout/header';
import type { ReferenceLocation, RouteViewport } from '@/commons/types/runroute';
import { CoursesList } from '@/components/courses-list';
import { TmapHome } from '@/components/tmap/home';
import { useCourseLikes } from '@/hooks/useCourseLikes';

import { useRoutes } from './hooks/index.use-routes';
import styles from './styles.module.css';
import {
  buildCourseCardViews,
  dedupeRoutesById,
  filterRoutesByCategories,
  filterRoutesByRouteViewport,
  SEOUL_CITY_HALL_REFERENCE,
  type DistanceCategory,
} from './utils/course-filter';

const TAB_ITEMS = [
  { label: '~3km', variant: 'blue' as const, category: 'UNDER_3' as const },
  { label: '3~5km', variant: 'green' as const, category: 'BETWEEN_3_AND_5' as const },
  { label: '5~10km', variant: 'red' as const, category: 'BETWEEN_5_AND_10' as const },
  { label: '10km~', variant: 'orange' as const, category: 'OVER_10' as const },
];

export function Home() {
  type HomeToast = {
    type: 'no-course' | 'zoom-limit';
    message: string;
  };

  // [상태] 홈 화면 기본 상태 관리
  const [sheetVisibleHeight, setSheetVisibleHeight] = useState(260);
  const sheetVisibleHeightRef = useRef(sheetVisibleHeight);
  sheetVisibleHeightRef.current = sheetVisibleHeight;
  const [openPeekFromCollapsedSignal, setOpenPeekFromCollapsedSignal] = useState(0);
  const [markerClickRecenterToken, setMarkerClickRecenterToken] = useState(0);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<DistanceCategory>>(new Set());
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [homeToast, setHomeToast] = useState<HomeToast | null>(null);
  const [mapMoveSignal, setMapMoveSignal] = useState(0);
  /** 목록 노출용 — 바텀시트로 가려지지 않은 영역 */
  const [visibleRouteViewport, setVisibleRouteViewport] = useState<RouteViewport | null>(null);
  const [frozenVisibleRouteViewport, setFrozenVisibleRouteViewport] = useState<RouteViewport | null>(
    null,
  );
  const [referenceLocation, setReferenceLocation] =
    useState<ReferenceLocation>(SEOUL_CITY_HALL_REFERENCE);
  const effectiveQueryViewport = isSheetExpanded
    ? frozenVisibleRouteViewport
    : visibleRouteViewport;
  const { routes, allRoutes, isLoading, errorMessage } = useRoutes(effectiveQueryViewport);
  const router = useRouter();
  const previousQueryViewportRef = useRef<RouteViewport | null>(null);
  const noCourseToastDelayTimerRef = useRef<number | null>(null);

  const showHomeToast = useCallback((type: HomeToast['type'], message: string) => {
    setHomeToast({ type, message });
  }, []);

  const isSameViewport = useCallback((left: RouteViewport | null, right: RouteViewport | null) => {
    if (!left || !right) return false;
    return (
      left.northEastLat === right.northEastLat &&
      left.northEastLng === right.northEastLng &&
      left.southWestLat === right.southWestLat &&
      left.southWestLng === right.southWestLng
    );
  }, []);

  const handleViewportChanged = useCallback(() => {}, []);

  const handleVisibleRouteViewportChanged = useCallback(
    (nextViewport: RouteViewport | null) => {
      if (!nextViewport) return;
      setVisibleRouteViewport((previous) =>
        isSameViewport(previous, nextViewport) ? previous : { ...nextViewport },
      );
    },
    [isSameViewport],
  );

  useEffect(() => {
    if (!isSheetExpanded && visibleRouteViewport) {
      setFrozenVisibleRouteViewport((previous) =>
        isSameViewport(previous, visibleRouteViewport) ? previous : { ...visibleRouteViewport },
      );
    }
  }, [isSameViewport, isSheetExpanded, visibleRouteViewport]);

  useEffect(() => {
    if (!effectiveQueryViewport) return;
    const previous = previousQueryViewportRef.current;
    if (previous && !isSameViewport(previous, effectiveQueryViewport)) {
      setMapMoveSignal((prev) => prev + 1);
    }
    previousQueryViewportRef.current = effectiveQueryViewport;
  }, [effectiveQueryViewport, isSameViewport]);

  useEffect(() => {
    if (noCourseToastDelayTimerRef.current !== null) {
      window.clearTimeout(noCourseToastDelayTimerRef.current);
      noCourseToastDelayTimerRef.current = null;
    }

    if (!mapMoveSignal || isLoading || !!errorMessage) {
      setHomeToast((previous) => (previous?.type === 'no-course' ? null : previous));
      return;
    }
    if (routes.length > 0) {
      setHomeToast((previous) => (previous?.type === 'no-course' ? null : previous));
      return;
    }

    noCourseToastDelayTimerRef.current = window.setTimeout(() => {
      showHomeToast('no-course', '해당 영역에 등록된 코스가 없습니다.');
      noCourseToastDelayTimerRef.current = null;
    }, 1500);

    return () => {
      if (noCourseToastDelayTimerRef.current !== null) {
        window.clearTimeout(noCourseToastDelayTimerRef.current);
        noCourseToastDelayTimerRef.current = null;
      }
    };
  }, [errorMessage, isLoading, mapMoveSignal, routes.length, showHomeToast]);

  useEffect(() => {
    return () => {
      if (noCourseToastDelayTimerRef.current !== null) {
        window.clearTimeout(noCourseToastDelayTimerRef.current);
      }
    };
  }, []);

  // [파생데이터] 필터/정렬 결과 계산 (선택된 코스는 뷰포트 밖이어도 목록·지도에 유지)
  const filteredRoutes = useMemo(() => {
    const base = filterRoutesByCategories(routes, selectedCategories);
    if (!selectedCourseId) {
      return base;
    }
    if (base.some((route) => route.id === selectedCourseId)) {
      return base;
    }
    const selected = allRoutes.find((route) => route.id === selectedCourseId);
    if (!selected) {
      return base;
    }
    return dedupeRoutesById([selected, ...base]);
  }, [routes, selectedCategories, selectedCourseId, allRoutes]);

  const routesForCourseList = useMemo(() => {
    const base = filterRoutesByRouteViewport(filteredRoutes, visibleRouteViewport);
    if (!selectedCourseId) {
      return base;
    }
    if (base.some((route) => route.id === selectedCourseId)) {
      return base;
    }
    const selected = allRoutes.find((route) => route.id === selectedCourseId);
    if (!selected) {
      return base;
    }
    return dedupeRoutesById([selected, ...base]);
  }, [filteredRoutes, visibleRouteViewport, selectedCourseId, allRoutes]);

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
  const { isCourseLiked, getCourseLikeCount, toggleCourseLike } = useCourseLikes(courseLikeCounts);

  // [초기화] 사용자 위치 기반 기준 좌표 설정
  useEffect(() => {
    let isCancelled = false;

    if (!navigator.geolocation) {
      setReferenceLocation(SEOUL_CITY_HALL_REFERENCE);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (isCancelled) return;
        setReferenceLocation({
          type: 'CURRENT_USER_LOCATION',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        if (isCancelled) return;
        setReferenceLocation(SEOUL_CITY_HALL_REFERENCE);
      },
      { enableHighAccuracy: false, timeout: 5000 },
    );

    return () => {
      isCancelled = true;
    };
  }, []);

  // [이벤트] 거리 카테고리 선택 토글 처리
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
      {/* [UI] 상단 헤더 영역 */}
      <div className={styles.topChrome}>
        <Header showLogo showLeftIcon={false} showRightIcon={false} title="RouteRun" />
      </div>
      {/* [UI] 거리 카테고리 탭 영역 */}
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

      {/* [UI] 조회 실패 메시지 영역 */}
      {errorMessage ? (
        <p role="status" className={styles.errorMessage}>
          {errorMessage}
        </p>
      ) : null}

      {/* [UI] 지도/코스 목록 연동 영역 */}
      <div className={styles.mapStage}>
        <div className={styles.map}>
          <TmapHome
            bottomSheetVisibleHeight={sheetVisibleHeight}
            isBottomSheetExpanded={isSheetExpanded}
            routes={filteredRoutes}
            selectedCourseId={selectedCourseId}
            markerClickRecenterToken={markerClickRecenterToken}
            onCourseMarkerClick={handleCourseMarkerClick}
            onViewportChanged={handleViewportChanged}
            onVisibleViewportChanged={handleVisibleRouteViewportChanged}
            onZoomLimitReached={(limit) => {
              if (limit === 'min') {
                showHomeToast('zoom-limit', '최소 배율 도달');
                return;
              }
              showHomeToast('zoom-limit', '최대 배율 도달');
            }}
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
            router.push(ROUTES.COURSES.DETAIL(courseId));
          }}
          onCourseLikeToggle={toggleCourseLike}
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
