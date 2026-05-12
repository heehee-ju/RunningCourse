'use client';

import { useEffect, type Dispatch, type SetStateAction } from 'react';

import type { Route } from '@/commons/types/runroute';

type SetSelectedRouteSnapshot = Dispatch<SetStateAction<Route | null>>;

/**
 * 선택 코스 id가 없어질 때만 스냅샷을 비운다.
 * id 불일치 시 곧바로 null로 두면 URL·상태 갱신 한 틱 어긋남으로 뷰포트 밖 병합이 깨져 마커가 사라질 수 있다.
 */
export function useClearSelectedRouteSnapshotOnDeselect(
  selectedCourseId: string | null,
  setSelectedRouteSnapshot: SetSelectedRouteSnapshot,
) {
  useEffect(() => {
    if (!selectedCourseId) {
      setSelectedRouteSnapshot(null);
    }
  }, [selectedCourseId, setSelectedRouteSnapshot]);
}
