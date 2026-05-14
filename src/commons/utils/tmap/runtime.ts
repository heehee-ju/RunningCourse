import type { TmapV3API } from '@/commons/utils/tmap/types';

export function getTmapv3Runtime(): TmapV3API | undefined {
  const globalWindow = window as unknown as {
    Tmapv3?: TmapV3API;
  };
  return globalWindow.Tmapv3;
}
