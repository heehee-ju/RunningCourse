'use client';

import { useCallback, useMemo, useState } from 'react';

import type { CourseCardView } from '@/commons/types/routerun';

import { sortCourseCardsForDisplay, type CourseListSortMode } from '../utils/sort-course-cards';

export function useCourseListSort(
  cards: CourseCardView[],
  getCourseLikeCount?: (courseId: string) => number,
) {
  const [sortMode, setSortMode] = useState<CourseListSortMode>('distance');

  const displayCards = useMemo(
    () => sortCourseCardsForDisplay(cards, sortMode, getCourseLikeCount),
    [cards, getCourseLikeCount, sortMode],
  );

  const selectSortMode = useCallback((mode: CourseListSortMode) => {
    setSortMode(mode);
  }, []);

  return { sortMode, displayCards, selectSortMode };
}
