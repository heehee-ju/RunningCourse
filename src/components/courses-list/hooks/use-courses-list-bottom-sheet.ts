'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import {
  PAN_DOWN_DRAG_THRESHOLD,
  PAN_DOWN_VELOCITY_THRESHOLD,
  PAN_DRAG_THRESHOLD,
  PAN_VELOCITY_THRESHOLD,
  PEEK_VISIBLE_HEIGHT,
  type BottomSheetState,
  computeSheetTranslateY,
  getNextSheetState,
  roundUpToEven,
} from '../utils/bottom-sheet';

import type { PanInfo } from 'framer-motion';

export type SheetPositionPayload = {
  state: BottomSheetState;
  visibleHeight: number;
};

type UseCoursesListBottomSheetParams = {
  openPeekFromCollapsedSignal?: number;
  onSheetPositionChange?: (payload: SheetPositionPayload) => void;
};

/** 바텀시트 높이·드래그·부모 동기화 로직 */
export function useCoursesListBottomSheet({
  openPeekFromCollapsedSignal,
  onSheetPositionChange,
}: UseCoursesListBottomSheetParams) {
  const [sheetState, setSheetState] = useState<BottomSheetState>('peek');
  const [sheetHeight, setSheetHeight] = useState(0);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === 'undefined'
      ? 0
      : roundUpToEven(window.visualViewport?.height ?? window.innerHeight),
  );
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const cardListRef = useRef<HTMLDivElement | null>(null);
  const isSheetInteractionLocked = false;
  const effectiveSheetState: BottomSheetState = isSheetInteractionLocked ? 'peek' : sheetState;

  const handleToggleByClick = () => {
    if (isSheetInteractionLocked) return;
    setSheetState((prev) => (prev === 'expanded' ? 'peek' : getNextSheetState(prev, 'up')));
  };

  const handlePan = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (isSheetInteractionLocked) return;
    setDragOffsetY(info.offset.y);
  };

  const handlePanEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (isSheetInteractionLocked) return;
    setIsDragging(false);
    setDragOffsetY(0);

    if (info.offset.y <= -PAN_DRAG_THRESHOLD || info.velocity.y <= -PAN_VELOCITY_THRESHOLD) {
      setSheetState((prev) => getNextSheetState(prev, 'up'));
      return;
    }

    if (
      info.offset.y >= PAN_DOWN_DRAG_THRESHOLD ||
      info.velocity.y >= PAN_DOWN_VELOCITY_THRESHOLD
    ) {
      setSheetState((prev) => getNextSheetState(prev, 'down'));
    }
  };

  const handleHandleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isSheetInteractionLocked) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleToggleByClick();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSheetState((prev) => getNextSheetState(prev, 'up'));
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSheetState((prev) => getNextSheetState(prev, 'down'));
    }
  };

  const recalculateSheetHeights = useCallback(() => {
    const sheetElement = sheetRef.current;
    if (!sheetElement) {
      return;
    }

    const nextSheetHeight = sheetElement.clientHeight;
    if (nextSheetHeight <= 0) {
      return;
    }
    setSheetHeight(nextSheetHeight);
  }, []);

  useLayoutEffect(() => {
    recalculateSheetHeights();
  }, [recalculateSheetHeights]);

  useEffect(() => {
    recalculateSheetHeights();

    const resizeObserver = new ResizeObserver(() => {
      recalculateSheetHeights();
    });
    if (sheetRef.current) {
      resizeObserver.observe(sheetRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [recalculateSheetHeights]);

  useEffect(() => {
    const syncViewportHeight = () => {
      setViewportHeight(roundUpToEven(window.visualViewport?.height ?? window.innerHeight));
    };

    syncViewportHeight();
    window.addEventListener('resize', syncViewportHeight);
    window.visualViewport?.addEventListener('resize', syncViewportHeight);
    return () => {
      window.removeEventListener('resize', syncViewportHeight);
      window.visualViewport?.removeEventListener('resize', syncViewportHeight);
    };
  }, []);

  useEffect(() => {
    if (openPeekFromCollapsedSignal === undefined || openPeekFromCollapsedSignal <= 0) {
      return;
    }
    setSheetState((previous) => {
      if (previous !== 'collapsed') {
        return previous;
      }
      requestAnimationFrame(() => {
        cardListRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      });
      return 'peek';
    });
  }, [openPeekFromCollapsedSignal]);

  const effectiveSheetHeight = sheetHeight > 0 ? sheetHeight : viewportHeight;
  const liveTranslateY = computeSheetTranslateY({
    effectiveSheetState,
    effectiveSheetHeight,
    isDragging,
    dragOffsetY,
    peekVisibleHeight: PEEK_VISIBLE_HEIGHT,
  });

  useEffect(() => {
    const sheetElement = sheetRef.current;
    if (!sheetElement) return;
    sheetElement.style.setProperty('--sheet-translate-y', `${Math.round(liveTranslateY)}px`);
    return () => {
      sheetElement.style.removeProperty('--sheet-translate-y');
    };
  }, [liveTranslateY]);

  useEffect(() => {
    const visibleHeightByState = Math.max(24, effectiveSheetHeight - liveTranslateY);

    onSheetPositionChange?.({
      state: effectiveSheetState,
      visibleHeight: roundUpToEven(visibleHeightByState),
    });
  }, [effectiveSheetHeight, effectiveSheetState, liveTranslateY, onSheetPositionChange]);

  const handlePanStart = () => {
    if (isSheetInteractionLocked) return;
    setIsDragging(true);
  };

  return {
    sheetRef,
    cardListRef,
    sheetState: effectiveSheetState,
    isDragging,
    handleToggleByClick,
    handlePan,
    handlePanEnd,
    handleHandleKeyDown,
    handlePanStart,
  };
}
