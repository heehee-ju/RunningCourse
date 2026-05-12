'use client';

import { motion } from 'framer-motion';

import { Card } from '@/commons/components/card';
import type { CourseCardView } from '@/commons/types/runroute';

import { CourseListSortDropdown } from './course-list-sort-dropdown';
import { useCourseListSort } from './hooks/use-course-list-sort';
import {
  useCoursesListBottomSheet,
  type SheetPositionPayload,
} from './hooks/use-courses-list-bottom-sheet';
import { useCoursesListEmptySheetState } from './hooks/use-courses-list-empty-sheet-state';
import styles from './styles.module.css';
import { SKELETON_CARD_COUNT } from './utils/bottom-sheet';

import type { KeyboardEvent } from 'react';

type CoursesListProps = {
  cards?: CourseCardView[];
  isLoading?: boolean;
  /** false면 아직 조회 뷰포트 없음 — 빈 목록으로 시트 접힘 고정하지 않음 */
  isRouteQueryViewportReady?: boolean;
  isCourseLiked?: (courseId: string) => boolean;
  getCourseLikeCount?: (courseId: string) => number;
  openPeekFromCollapsedSignal?: number;
  onSheetPositionChange?: (payload: SheetPositionPayload) => void;
  onCourseSelect?: (courseId: string) => void;
};

export function CoursesList({
  cards = [],
  isLoading = false,
  isRouteQueryViewportReady = true,
  isCourseLiked,
  getCourseLikeCount,
  openPeekFromCollapsedSignal,
  onSheetPositionChange,
  onCourseSelect,
}: CoursesListProps) {
  const { sortMode, displayCards, selectSortMode } = useCourseListSort(cards, getCourseLikeCount);

  const { isEmpty } = useCoursesListEmptySheetState({
    listLength: displayCards.length,
    isLoading,
    isRouteQueryViewportReady,
  });

  const {
    sheetRef,
    cardListRef,
    sheetState,
    isDragging,
    handleToggleByClick,
    handlePan,
    handlePanEnd,
    handleHandleKeyDown,
    handlePanStart,
  } = useCoursesListBottomSheet({
    openPeekFromCollapsedSignal,
    isEmpty,
    onSheetPositionChange,
  });

  const sheetStateClassName =
    sheetState === 'collapsed'
      ? styles.collapsed
      : sheetState === 'peek'
        ? styles.peek
        : styles.expanded;

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
        onPanStart={handlePanStart}
        onPan={handlePan}
        onPanEnd={handlePanEnd}
      >
        <div className={styles.bottomSheetHandle} />
      </motion.div>
      <div className={styles.courseListTitleRow}>
        <h2 className={styles.courseListTitle}>러닝코스 목록</h2>
        <CourseListSortDropdown sortMode={sortMode} onSelect={selectSortMode} />
      </div>
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
        {displayCards.map((card) => (
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
              thumbnailUrl={card.thumbnailUrl}
              readonlyLike={true}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default CoursesList;

export type { SheetPositionPayload };
export type { CourseListSortMode } from './utils/sort-course-cards';
