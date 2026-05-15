'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type HomeToast = {
  type: 'no-course' | 'zoom-limit';
  message: string;
};

type UseHomeToastParams = {
  mapMoveSignal: number;
  routesLength: number;
  isLoading: boolean;
  errorMessage: string | null;
};

const HOME_TOAST_AUTO_HIDE_MS = 1500;
const HOME_TOAST_FADE_OUT_MS = 180;

/** 홈 토스트(줌 한도·해당 영역 무코스) 표시·자동 숨김(페이드아웃) 및 타이머 정리 */
export function useHomeToast({
  mapMoveSignal,
  routesLength,
  isLoading,
  errorMessage,
}: UseHomeToastParams) {
  const [homeToast, setHomeToast] = useState<HomeToast | null>(null);
  const [isHomeToastFadingOut, setIsHomeToastFadingOut] = useState(false);
  const noCourseToastDelayTimerRef = useRef<number | null>(null);
  const toastDismissPhase1TimerRef = useRef<number | null>(null);
  const toastDismissPhase2TimerRef = useRef<number | null>(null);

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
    if (noCourseToastDelayTimerRef.current !== null) {
      window.clearTimeout(noCourseToastDelayTimerRef.current);
      noCourseToastDelayTimerRef.current = null;
    }

    if (isLoading || !!errorMessage) {
      clearToastDismissTimers();
      setIsHomeToastFadingOut(false);
      setHomeToast((previous) => (previous?.type === 'no-course' ? null : previous));
      return;
    }
    if (routesLength > 0) {
      clearToastDismissTimers();
      setIsHomeToastFadingOut(false);
      setHomeToast((previous) => (previous?.type === 'no-course' ? null : previous));
      return;
    }

    noCourseToastDelayTimerRef.current = window.setTimeout(() => {
      showHomeToast('no-course', '해당 영역에 등록된 코스가 없습니다.');
      noCourseToastDelayTimerRef.current = null;
    }, 200);

    return () => {
      if (noCourseToastDelayTimerRef.current !== null) {
        window.clearTimeout(noCourseToastDelayTimerRef.current);
        noCourseToastDelayTimerRef.current = null;
      }
    };
  }, [
    clearToastDismissTimers,
    errorMessage,
    isLoading,
    mapMoveSignal,
    routesLength,
    showHomeToast,
  ]);

  useEffect(() => {
    return () => {
      if (noCourseToastDelayTimerRef.current !== null) {
        window.clearTimeout(noCourseToastDelayTimerRef.current);
      }
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
