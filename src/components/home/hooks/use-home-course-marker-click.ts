'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import type { Route } from '@/commons/types/runroute';

type Params = {
  /** 접힘 상태에서 피크 시트를 열 때 기준 높이(px) — 이 값 이하면 피크 오픈 시그널 증가 */
  collapsedPeekHeightThreshold: number;
  sheetVisibleHeightRef: MutableRefObject<number>;
  setSelectedCourseId: Dispatch<SetStateAction<string | null>>;
  setSelectedRouteSnapshot: Dispatch<SetStateAction<Route | null>>;
  setMarkerClickRecenterToken: Dispatch<SetStateAction<number>>;
  setOpenPeekFromCollapsedSignal: Dispatch<SetStateAction<number>>;
};

/**
 * 지도 마커 클릭: 선택·스냅샷·재중심 토큰 갱신, 시트가 거의 닫힌 상태면 피크 시트 오픈 시그널
 */
export function useHomeCourseMarkerClick({
  collapsedPeekHeightThreshold,
  sheetVisibleHeightRef,
  setSelectedCourseId,
  setSelectedRouteSnapshot,
  setMarkerClickRecenterToken,
  setOpenPeekFromCollapsedSignal,
}: Params) {
  return useCallback(
    (courseId: string, route: Route) => {
      setSelectedCourseId(courseId);
      setSelectedRouteSnapshot(route);
      setMarkerClickRecenterToken((previous) => previous + 1);
      if (sheetVisibleHeightRef.current <= collapsedPeekHeightThreshold) {
        setOpenPeekFromCollapsedSignal((previous) => previous + 1);
      }
    },
    [
      collapsedPeekHeightThreshold,
      sheetVisibleHeightRef,
      setSelectedCourseId,
      setSelectedRouteSnapshot,
      setMarkerClickRecenterToken,
      setOpenPeekFromCollapsedSignal,
    ],
  );
}
