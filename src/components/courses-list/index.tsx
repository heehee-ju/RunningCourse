'use client';

import { motion, type PanInfo } from 'framer-motion';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import { Card } from '@/commons/components/card';
import type { CourseCardView } from '@/commons/types/runroute';

import styles from './styles.module.css';

type BottomSheetState = 'collapsed' | 'peek' | 'expanded';

const SHEET_ORDER: BottomSheetState[] = ['collapsed', 'peek', 'expanded'];
const PEEK_VISIBLE_HEIGHT = 260;
const SKELETON_CARD_COUNT = 3;

type SheetPositionPayload = {
  state: BottomSheetState;
  visibleHeight: number;
};

function roundUpToEven(value: number): number {
  const rounded = Math.ceil(value);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

// [계산] 바텀시트 다음 상태 계산
function getNextState(current: BottomSheetState, direction: 'up' | 'down'): BottomSheetState {
  const currentIndex = SHEET_ORDER.indexOf(current);
  if (direction === 'up') {
    return SHEET_ORDER[Math.min(currentIndex + 1, SHEET_ORDER.length - 1)];
  }
  return SHEET_ORDER[Math.max(currentIndex - 1, 0)];
}

type CoursesListProps = {
  cards?: CourseCardView[];
  isLoading?: boolean;
  isCourseLiked?: (courseId: string) => boolean;
  getCourseLikeCount?: (courseId: string) => number;
  /** 바텀이 접힌 상태에서 마커 선택 시 증가시키면 시트를 peek으로 올린다 */
  openPeekFromCollapsedSignal?: number;
  onSheetPositionChange?: (payload: SheetPositionPayload) => void;
  onCourseSelect?: (courseId: string) => void;
  onCourseLikeToggle?: (courseId: string) => void;
};

export function CoursesList({
  cards = [],
  isLoading = false,
  isCourseLiked,
  getCourseLikeCount,
  openPeekFromCollapsedSignal,
  onSheetPositionChange,
  onCourseSelect,
  onCourseLikeToggle,
}: CoursesListProps) {
  // [상태] 바텀시트 표시 상태 관리
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

  // [이벤트] 핸들 클릭 기반 상태 토글
  const handleToggleByClick = () => {
    if (isSheetInteractionLocked) return;
    setSheetState((prev) => (prev === 'expanded' ? 'peek' : getNextState(prev, 'up')));
  };

  // [이벤트] 드래그 제스처 기반 상태 전환
  const handlePan = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (isSheetInteractionLocked) return;
    setDragOffsetY(info.offset.y);
  };

  const handlePanEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (isSheetInteractionLocked) return;
    setIsDragging(false);
    setDragOffsetY(0);
    const DRAG_THRESHOLD = 12;
    const VELOCITY_THRESHOLD = 140;
    const DOWN_DRAG_THRESHOLD = 8;
    const DOWN_VELOCITY_THRESHOLD = 90;

    if (info.offset.y <= -DRAG_THRESHOLD || info.velocity.y <= -VELOCITY_THRESHOLD) {
      setSheetState((prev) => getNextState(prev, 'up'));
      return;
    }

    if (info.offset.y >= DOWN_DRAG_THRESHOLD || info.velocity.y >= DOWN_VELOCITY_THRESHOLD) {
      setSheetState((prev) => getNextState(prev, 'down'));
    }
  };

  // [접근성] 키보드 입력 기반 상태 전환
  const handleHandleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isSheetInteractionLocked) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleToggleByClick();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSheetState((prev) => getNextState(prev, 'up'));
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSheetState((prev) => getNextState(prev, 'down'));
    }
  };

  // 시트 실높이만 측정하고, peek 노출 높이는 고정값으로 유지한다.
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

  // [연동] 지도 마커 클릭 시(부모에서 시그널 증가) 접힌 바텀시트를 peek으로 복구
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

  // [초기 렌더 보정] 실제 높이 측정 전에는 뷰포트 높이로 시트 이동값을 계산한다.
  const effectiveSheetHeight = sheetHeight > 0 ? sheetHeight : viewportHeight;
  const minTranslateY = 20;
  const maxTranslateY = Math.max(0, effectiveSheetHeight - 24);
  const baseTranslateY =
    effectiveSheetState === 'collapsed'
      ? Math.max(0, effectiveSheetHeight - 24)
      : effectiveSheetState === 'peek'
        ? Math.max(0, effectiveSheetHeight - PEEK_VISIBLE_HEIGHT)
        : 20;
  const liveTranslateY = Math.min(
    maxTranslateY,
    Math.max(minTranslateY, baseTranslateY + (isDragging ? dragOffsetY : 0)),
  );
  const sheetStateClassName =
    effectiveSheetState === 'collapsed'
      ? styles.collapsed
      : effectiveSheetState === 'peek'
        ? styles.peek
        : styles.expanded;

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

    // [동기화] 부모 컴포넌트에 시트 위치 전달
    onSheetPositionChange?.({
      state: effectiveSheetState,
      visibleHeight: roundUpToEven(visibleHeightByState),
    });
  }, [effectiveSheetHeight, effectiveSheetState, liveTranslateY, onSheetPositionChange]);

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>, courseId: string) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onCourseSelect?.(courseId);
    }
  };

  return (
    <div
      ref={sheetRef}
      className={`${styles.courseList} ${sheetStateClassName} ${isDragging ? styles.dragging : ''}`}
    >
      <motion.div
        className={styles.bottomSheetHandleArea}
        role="button"
        tabIndex={0}
        aria-label="러닝코스 목록 바텀시트 조절"
        onClick={handleToggleByClick}
        onKeyDown={handleHandleKeyDown}
        onPanStart={() => {
          if (isSheetInteractionLocked) return;
          setIsDragging(true);
        }}
        onPan={handlePan}
        onPanEnd={handlePanEnd}
      >
        <div className={styles.bottomSheetHandle} />
      </motion.div>
      <h2 className={styles.courseListTitle}>러닝코스 목록</h2>
      <div ref={cardListRef} className={styles.cardList}>
        {isLoading && cards.length === 0 ? (
          <div className={styles.listLoadingBlock} aria-busy>
            {Array.from({ length: SKELETON_CARD_COUNT }).map((_, index) => (
              <div key={`skeleton-${index}`} className={styles.loadingCardSkeleton}>
                <div className={styles.loadingThumbnailSkeleton} />
                <div className={styles.loadingContentSkeleton}>
                  <div className={styles.loadingLineLg} />
                  <div className={styles.loadingLineMd} />
                  <div className={styles.loadingLineSm} />
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {cards.map((card) => (
          <div
            key={card.courseId}
            role="button"
            tabIndex={0}
            aria-label={`${card.title} 코스 선택`}
            onClick={() => onCourseSelect?.(card.courseId)}
            onKeyDown={(event) => handleCardKeyDown(event, card.courseId)}
          >
            <Card
              className={styles.cardWidth}
              type="default"
              isLiked={isCourseLiked?.(card.courseId) ?? false}
              isSelected={card.isPinnedTop}
              title={card.title}
              location={card.location}
              distanceText={card.distanceText}
              likeCount={getCourseLikeCount?.(card.courseId) ?? card.likeCount}
              onLikeClick={() => onCourseLikeToggle?.(card.courseId)}
            />
          </div>
        ))}
        {!isLoading && cards.length === 0 ? (
          <p className={styles.emptyState}>표시할 코스가 없습니다.</p>
        ) : null}
      </div>
    </div>
  );
}

export default CoursesList;
