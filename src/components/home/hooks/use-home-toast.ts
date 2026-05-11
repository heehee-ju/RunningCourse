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

/** 홈 토스트(줌 한도·해당 영역 무코스) 표시 및 타이머 정리 */
export function useHomeToast({
  mapMoveSignal,
  routesLength,
  isLoading,
  errorMessage,
}: UseHomeToastParams) {
  const [homeToast, setHomeToast] = useState<HomeToast | null>(null);
  const noCourseToastDelayTimerRef = useRef<number | null>(null);
  const zoomLimitToastHideTimerRef = useRef<number | null>(null);

  const showHomeToast = useCallback((type: HomeToast['type'], message: string) => {
    setHomeToast({ type, message });
    if (type !== 'zoom-limit') return;
    if (zoomLimitToastHideTimerRef.current !== null) {
      window.clearTimeout(zoomLimitToastHideTimerRef.current);
      zoomLimitToastHideTimerRef.current = null;
    }
    zoomLimitToastHideTimerRef.current = window.setTimeout(() => {
      setHomeToast((previous) => (previous?.type === 'zoom-limit' ? null : previous));
      zoomLimitToastHideTimerRef.current = null;
    }, 1500);
  }, []);

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
    setHomeToast((previous) => (previous?.type === 'zoom-limit' ? null : previous));
  }, []);

  useEffect(() => {
    if (noCourseToastDelayTimerRef.current !== null) {
      window.clearTimeout(noCourseToastDelayTimerRef.current);
      noCourseToastDelayTimerRef.current = null;
    }

    if (isLoading || !!errorMessage) {
      setHomeToast((previous) => (previous?.type === 'no-course' ? null : previous));
      return;
    }
    if (routesLength > 0) {
      setHomeToast((previous) => (previous?.type === 'no-course' ? null : previous));
      return;
    }

    noCourseToastDelayTimerRef.current = window.setTimeout(() => {
      showHomeToast('no-course', '해당 영역에 등록된 코스가 없습니다.');
      noCourseToastDelayTimerRef.current = null;
    }, 500);

    return () => {
      if (noCourseToastDelayTimerRef.current !== null) {
        window.clearTimeout(noCourseToastDelayTimerRef.current);
        noCourseToastDelayTimerRef.current = null;
      }
    };
  }, [errorMessage, isLoading, mapMoveSignal, routesLength, showHomeToast]);

  useEffect(() => {
    return () => {
      if (noCourseToastDelayTimerRef.current !== null) {
        window.clearTimeout(noCourseToastDelayTimerRef.current);
      }
      if (zoomLimitToastHideTimerRef.current !== null) {
        window.clearTimeout(zoomLimitToastHideTimerRef.current);
      }
    };
  }, []);

  return {
    homeToast,
    showHomeToast,
    handleZoomLimitReached,
    handleZoomLimitCleared,
  };
}
