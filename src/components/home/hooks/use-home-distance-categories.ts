'use client';

import { useCallback, useState } from 'react';

import type { DistanceCategory } from '../utils/course-filter';

/** 홈 탭 거리 카테고리 필터(Set) 및 탭 클릭 토글 */
export function useHomeDistanceCategories() {
  const [selectedCategories, setSelectedCategories] = useState<Set<DistanceCategory>>(new Set());

  const toggleCategory = useCallback((category: DistanceCategory) => {
    setSelectedCategories((previous) => {
      const next = new Set(previous);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  return { selectedCategories, setSelectedCategories, toggleCategory };
}
