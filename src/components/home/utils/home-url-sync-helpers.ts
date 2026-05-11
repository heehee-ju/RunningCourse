// 홈 URL 동기화 훅에서 쓰는 순수 함수(쿼리 병합·거리 탭 파싱 등).

import { TAB_ITEMS } from './home-constants';

import type { DistanceCategory } from './course-filter';
import type { ReadonlyURLSearchParams } from 'next/navigation';

/** 콤마 구분 거리 탭 값 → 유효한 카테고리만 담은 Set */
export function parseDistanceCategoriesFromQuery(raw: string): Set<DistanceCategory> {
  const next = new Set<DistanceCategory>();
  raw.split(',').forEach((token) => {
    const category = token.trim();
    if (TAB_ITEMS.some((item) => item.category === category)) {
      next.add(category as DistanceCategory);
    }
  });
  return next;
}

/** TAB_ITEMS 순서로 직렬화해 Set 동등 비교 (Set 순회 없이 빌드 타깃 이슈 회피) */
function serializeDistanceCategorySet(s: Set<DistanceCategory>): string {
  return TAB_ITEMS.map((item) => item.category)
    .filter((category) => s.has(category))
    .join(',');
}

export function areDistanceCategorySetsEqual(
  a: Set<DistanceCategory>,
  b: Set<DistanceCategory>,
): boolean {
  return serializeDistanceCategorySet(a) === serializeDistanceCategorySet(b);
}

/**
 * 히스토리 복귀 직후 `useSearchParams()`가 빈 값으로 한 틱 먼저 올라오는 경우가 있어,
 * 같은 pathname이면 `window.location.search`로 비어 있는 키만 보강한다.
 * (상태→URL 동기화와 충돌하지 않도록 “읽기 전용” 병합만 수행)
 */
export function resolveHomeSearchParamsForRead(
  pathname: string,
  searchParams: ReadonlyURLSearchParams | null,
): URLSearchParams {
  const fromNext = new URLSearchParams(searchParams?.toString() ?? '');
  if (typeof window === 'undefined') return fromNext;
  if (window.location.pathname !== pathname) return fromNext;

  const merged = new URLSearchParams(fromNext.toString());
  const fromWindow = new URLSearchParams(window.location.search);
  fromWindow.forEach((value, key) => {
    if (!merged.has(key)) {
      merged.set(key, value);
    }
  });
  return merged;
}
