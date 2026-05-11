'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import type { MypageRouteCardData, MypageTab } from '@/commons/types/mypage';

const TAB_VALUES: MypageTab[] = ['my-course', 'liked-course'];

export function useMyPageTabs(myRoutes: MypageRouteCardData[], likedRoutes: MypageRouteCardData[]) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get('tab');
  const activeTab: MypageTab = TAB_VALUES.includes(rawTab as MypageTab)
    ? (rawTab as MypageTab)
    : 'my-course';

  const courses = useMemo(
    () => (activeTab === 'my-course' ? myRoutes : likedRoutes),
    [activeTab, likedRoutes, myRoutes],
  );

  const setTab = useCallback(
    (tab: MypageTab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      router.push(`/mypage?${params.toString()}`);
    },
    [router, searchParams],
  );

  return { activeTab, setTab, courses };
}
