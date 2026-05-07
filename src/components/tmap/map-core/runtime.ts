/**
 * Tmap SDK 전역 접근을 공통화하는 런타임 유틸.
 */

import type { TmapV3API } from '@/components/tmap/home/types';

export function getTmapv3Runtime(): TmapV3API | undefined {
  const globalWindow = window as unknown as {
    Tmapv3?: TmapV3API;
  };
  return globalWindow.Tmapv3;
}
