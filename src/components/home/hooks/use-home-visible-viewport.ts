'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';

import type { RouteViewport } from '@/commons/types/runroute';

import { HOME_SESSION_KEYS } from '../utils/home-constants';
import { isSameRouteViewport, isValidRouteViewport } from '../utils/viewport';

/** 지도에서 관측한 가시 뷰포트 상태 + sessionStorage 동기화 */
export function useHomeVisibleRouteViewport(
  setVisibleRouteViewport: Dispatch<SetStateAction<RouteViewport | null>>,
) {
  return useCallback(
    (nextViewport: RouteViewport | null) => {
      if (!nextViewport) return;
      setVisibleRouteViewport((previous) =>
        isSameRouteViewport(previous, nextViewport) ? previous : { ...nextViewport },
      );

      if (typeof window !== 'undefined' && isValidRouteViewport(nextViewport)) {
        window.sessionStorage.setItem(
          HOME_SESSION_KEYS.savedViewport,
          JSON.stringify(nextViewport),
        );
      }
    },
    [setVisibleRouteViewport],
  );
}
