// 홈 화면 탭·쿼리·세션 스토리지 키 상수

import type { DistanceCategory } from './course-filter';

export const TAB_ITEMS = [
  { label: '~3km', variant: 'blue' as const, category: 'UNDER_3' as const },
  { label: '3~5km', variant: 'green' as const, category: 'BETWEEN_3_AND_5' as const },
  { label: '5~10km', variant: 'red' as const, category: 'BETWEEN_5_AND_10' as const },
  { label: '10km~', variant: 'orange' as const, category: 'OVER_10' as const },
] as const satisfies ReadonlyArray<{
  label: string;
  variant: 'blue' | 'green' | 'red' | 'orange';
  category: DistanceCategory;
}>;

export const HOME_QUERY_KEYS = {
  selectedCourseId: 'courseId',
  categories: 'categories',
  sheet: 'sheet',
} as const;

export const HOME_SESSION_KEYS = {
  savedViewport: 'homeSavedViewport',
  restoreViewportOnce: 'homeRestoreViewportOnce',
  restoreSelectedFocusOnce: 'homeRestoreSelectedFocusOnce',
} as const;
