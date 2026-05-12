'use client';

import { useEffect, useState } from 'react';

type Params = {
  /** 목록에 그릴 카드 개수 (정렬·필터 반영 후) */
  listLength: number;
  isLoading: boolean;
  /** false면 뷰포트 미준비 — 빈 목록으로 시트 접힘을 확정하지 않음 */
  isRouteQueryViewportReady: boolean;
};

/**
 * 한 번 빈 목록이 확정되면 코스가 생길 때까지 재로딩 중에도 바텀시트 접힘을 유지한다.
 * `isEmpty`는 바텀시트 훅에 전달한다.
 */
export function useCoursesListEmptySheetState({
  listLength,
  isLoading,
  isRouteQueryViewportReady,
}: Params) {
  const [holdEmptySheetCollapsed, setHoldEmptySheetCollapsed] = useState(false);

  useEffect(() => {
    if (listLength > 0) {
      setHoldEmptySheetCollapsed(false);
      return;
    }
    if (!isRouteQueryViewportReady) {
      return;
    }
    if (!isLoading && listLength === 0) {
      setHoldEmptySheetCollapsed(true);
    }
  }, [isLoading, listLength, isRouteQueryViewportReady]);

  const isEmpty = listLength === 0 && holdEmptySheetCollapsed;

  return { isEmpty };
}
