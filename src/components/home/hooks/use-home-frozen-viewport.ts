'use client';

import { useEffect, type Dispatch, type SetStateAction } from 'react';

import type { RouteViewport } from '@/commons/types/runroute';

import { isSameRouteViewport } from '../utils/viewport';

/** 시트가 펼쳐지지 않을 때 보이는 뷰포트를 동결해 쿼리 bounds에 사용 */
export function useHomeFrozenViewportSync({
  isSheetExpanded,
  visibleRouteViewport,
  setFrozenVisibleRouteViewport,
}: {
  isSheetExpanded: boolean;
  visibleRouteViewport: RouteViewport | null;
  setFrozenVisibleRouteViewport: Dispatch<SetStateAction<RouteViewport | null>>;
}) {
  useEffect(() => {
    if (!isSheetExpanded && visibleRouteViewport) {
      setFrozenVisibleRouteViewport((previous) =>
        isSameRouteViewport(previous, visibleRouteViewport)
          ? previous
          : { ...visibleRouteViewport },
      );
    }
  }, [isSheetExpanded, setFrozenVisibleRouteViewport, visibleRouteViewport]);
}
