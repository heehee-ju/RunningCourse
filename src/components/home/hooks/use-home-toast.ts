'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { RouteViewport } from '@/commons/types/routerun';

export type HomeToast = {
  type: 'no-course' | 'zoom-limit';
  message: string;
};

type UseHomeToastParams = {
  queryViewport: RouteViewport | null;
  routesLength: number;
  isLoading: boolean;
  errorMessage: string | null;
};

const HOME_TOAST_AUTO_HIDE_MS = 800;
const HOME_TOAST_FADE_OUT_MS = 140;
const NO_COURSE_TOAST_MESSAGE = '해당 영역에 등록된 코스가 없습니다.';

function toQueryViewportKey(viewport: RouteViewport): string {
  return [
    viewport.northEastLat.toFixed(6),
    viewport.northEastLng.toFixed(6),
    viewport.southWestLat.toFixed(6),
    viewport.southWestLng.toFixed(6),
  ].join(',');
}

/** 홈 토스트(줌 한도·해당 영역 무코스) 표시·자동 숨김(페이드아웃) 및 타이머 정리 */
export function useHomeToast({
  queryViewport,
  routesLength,
  isLoading,
  errorMessage,
}: UseHomeToastParams) {
  const [homeToast, setHomeToast] = useState<HomeToast | null>(null);
  const [isHomeToastFadingOut, setIsHomeToastFadingOut] = useState(false);
  const toastDismissPhase1TimerRef = useRef<number | null>(null);
  const toastDismissPhase2TimerRef = useRef<number | null>(null);
  const lastNoCourseToastViewportKeyRef = useRef<string | null>(null);

  const clearToastDismissTimers = useCallback(() => {
    if (toastDismissPhase1TimerRef.current !== null) {
      window.clearTimeout(toastDismissPhase1TimerRef.current);
      toastDismissPhase1TimerRef.current = null;
    }
    if (toastDismissPhase2TimerRef.current !== null) {
      window.clearTimeout(toastDismissPhase2TimerRef.current);
      toastDismissPhase2TimerRef.current = null;
    }
  }, []);

  const dismissNoCourseToast = useCallback(() => {
    clearToastDismissTimers();
    setIsHomeToastFadingOut(false);
    setHomeToast((previous) => (previous?.type === 'no-course' ? null : previous));
  }, [clearToastDismissTimers]);

  const showHomeToast = useCallback(
    (type: HomeToast['type'], message: string) => {
      clearToastDismissTimers();
      setIsHomeToastFadingOut(false);
      setHomeToast({ type, message });

      toastDismissPhase1TimerRef.current = window.setTimeout(() => {
        setIsHomeToastFadingOut(true);
        toastDismissPhase2TimerRef.current = window.setTimeout(() => {
          setHomeToast((previous) => (previous?.type === type ? null : previous));
          setIsHomeToastFadingOut(false);
          toastDismissPhase2TimerRef.current = null;
        }, HOME_TOAST_FADE_OUT_MS);
        toastDismissPhase1TimerRef.current = null;
      }, HOME_TOAST_AUTO_HIDE_MS);
    },
    [clearToastDismissTimers],
  );

  const handleZoomLimitReached = useCallback(
    (limit: 'min' | 'max') => {
      if (limit === 'min') {
        showHomeToast('zoom-limit', '최소 배율 도달');
        return;
      }
      showHomeToast('zoom-limit', '최대 배율 도달');
    },
    [showHomeToast],
  );

  const handleZoomLimitCleared = useCallback(() => {
    clearToastDismissTimers();
    setIsHomeToastFadingOut(false);
    setHomeToast((previous) => (previous?.type === 'zoom-limit' ? null : previous));
  }, [clearToastDismissTimers]);

  useEffect(() => {
    const queryViewportKey = queryViewport ? toQueryViewportKey(queryViewport) : null;

    if (queryViewportKey === null) {
      lastNoCourseToastViewportKeyRef.current = null;
      return;
    }

    if (lastNoCourseToastViewportKeyRef.current !== queryViewportKey) {
      lastNoCourseToastViewportKeyRef.current = null;
    }

    if (isLoading || !!errorMessage) {
      return;
    }

    if (routesLength > 0) {
      lastNoCourseToastViewportKeyRef.current = null;
      dismissNoCourseToast();
      return;
    }

    if (lastNoCourseToastViewportKeyRef.current === queryViewportKey) {
      return;
    }

    lastNoCourseToastViewportKeyRef.current = queryViewportKey;
    showHomeToast('no-course', NO_COURSE_TOAST_MESSAGE);
  }, [dismissNoCourseToast, errorMessage, isLoading, queryViewport, routesLength, showHomeToast]);

  useEffect(() => {
    return () => {
      clearToastDismissTimers();
    };
  }, [clearToastDismissTimers]);

  return {
    homeToast,
    isHomeToastFadingOut,
    showHomeToast,
    handleZoomLimitReached,
    handleZoomLimitCleared,
  };
}
