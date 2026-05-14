/**
 * 홈 지도의 줌 제한/휠 입력/버튼 입력 로직을 묶는 훅.
 */

import { useCallback, useRef } from 'react';

import type { TmapMap } from '@/commons/utils/tmap/types';

import type { RefObject } from 'react';

const MIN_ZOOM_LEVEL = 8;
const MAX_ZOOM_LEVEL = 19;

type UseMapZoomControlsParams = {
  mapRef: RefObject<TmapMap | null>;
  scheduleViewportReport: (map: TmapMap, delay?: number) => void;
  onZoomLimitReached?: (limit: 'min' | 'max') => void;
  onZoomLimitCleared?: () => void;
};

export function useMapZoomControls({
  mapRef,
  scheduleViewportReport,
  onZoomLimitReached,
  onZoomLimitCleared,
}: UseMapZoomControlsParams) {
  const wheelZoomThrottleTimerRef = useRef<number | null>(null);
  const lastZoomLimitNoticeRef = useRef<'min' | 'max' | null>(null);

  const notifyZoomLimitState = useCallback(
    (currentZoom: number) => {
      if (currentZoom === MIN_ZOOM_LEVEL) {
        if (lastZoomLimitNoticeRef.current !== 'min') {
          lastZoomLimitNoticeRef.current = 'min';
          onZoomLimitReached?.('min');
        }
        return;
      }
      if (currentZoom === MAX_ZOOM_LEVEL) {
        if (lastZoomLimitNoticeRef.current !== 'max') {
          lastZoomLimitNoticeRef.current = 'max';
          onZoomLimitReached?.('max');
        }
        return;
      }
      if (lastZoomLimitNoticeRef.current !== null) {
        onZoomLimitCleared?.();
      }
      lastZoomLimitNoticeRef.current = null;
    },
    [onZoomLimitCleared, onZoomLimitReached],
  );

  const enforceMinZoomLevel = useCallback(
    (map: TmapMap): number | null => {
      const currentZoom = map.getZoom();
      if (typeof currentZoom !== 'number') return null;
      if (currentZoom < MIN_ZOOM_LEVEL) {
        map.setZoom(MIN_ZOOM_LEVEL);
        notifyZoomLimitState(MIN_ZOOM_LEVEL);
        return MIN_ZOOM_LEVEL;
      }
      notifyZoomLimitState(currentZoom);
      return currentZoom;
    },
    [notifyZoomLimitState],
  );

  const adjustZoomLevel = useCallback(
    (delta: 1 | -1) => {
      const map = mapRef.current;
      if (!map) return;

      const runtimeZoom = map.getZoom();
      if (typeof runtimeZoom !== 'number') return;
      const nextZoom =
        delta < 0
          ? Math.max(MIN_ZOOM_LEVEL, runtimeZoom + delta)
          : Math.min(MAX_ZOOM_LEVEL, runtimeZoom + delta);

      if (nextZoom === runtimeZoom) {
        notifyZoomLimitState(runtimeZoom);
        return;
      }

      // 이벤트 누락 환경에서도 limit 배너/토스트 상태를 즉시 동기화한다.
      notifyZoomLimitState(nextZoom);

      if (delta > 0 && typeof map.zoomIn === 'function') {
        map.zoomIn();
        return;
      }
      if (delta < 0 && typeof map.zoomOut === 'function') {
        map.zoomOut();
        return;
      }

      map.setZoom(nextZoom, { animation: true, animate: true, duration: 200 });
    },
    [mapRef, notifyZoomLimitState],
  );

  const handleMapWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      const map = mapRef.current;
      if (!map) return;
      if (wheelZoomThrottleTimerRef.current !== null) return;

      const delta: 1 | -1 = event.deltaY < 0 ? 1 : -1;
      adjustZoomLevel(delta);
      scheduleViewportReport(map);

      wheelZoomThrottleTimerRef.current = window.setTimeout(() => {
        wheelZoomThrottleTimerRef.current = null;
      }, 100);
    },
    [adjustZoomLevel, mapRef, scheduleViewportReport],
  );

  const clearZoomControlState = useCallback(() => {
    if (wheelZoomThrottleTimerRef.current !== null) {
      window.clearTimeout(wheelZoomThrottleTimerRef.current);
      wheelZoomThrottleTimerRef.current = null;
    }
    lastZoomLimitNoticeRef.current = null;
  }, []);

  return {
    MIN_ZOOM_LEVEL,
    MAX_ZOOM_LEVEL,
    enforceMinZoomLevel,
    notifyZoomLimitState,
    adjustZoomLevel,
    handleMapWheel,
    clearZoomControlState,
  };
}
