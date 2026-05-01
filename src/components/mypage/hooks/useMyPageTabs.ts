'use client';

import { useCallback, useMemo, useState } from 'react';

import type { MypageRouteCardData, MypageTab } from '@/commons/types/mypage';

export function useMyPageTabs(myRoutes: MypageRouteCardData[], likedRoutes: MypageRouteCardData[]) {
  const [activeTab, setActiveTab] = useState<MypageTab>('my-course');

  const courses = useMemo(
    () => (activeTab === 'my-course' ? myRoutes : likedRoutes),
    [activeTab, likedRoutes, myRoutes],
  );

  const setTab = useCallback((tab: MypageTab) => {
    setActiveTab(tab);
  }, []);

  return { activeTab, setTab, courses };
}
