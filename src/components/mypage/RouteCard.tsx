'use client';

import { useRouter } from 'next/navigation';

import { Card } from '@/commons/components/card';
import { ROUTES } from '@/commons/constants/url';
import type { MypageRouteCardData, MypageTab } from '@/commons/types/mypage';

import { useDeleteCourse } from './hooks/useDeleteCourse';

export type RouteCardProps = {
  tab: MypageTab;
  route: MypageRouteCardData;
};

export function RouteCard({ tab, route }: RouteCardProps) {
  const router = useRouter();
  const { isDeleting, deleteCourse } = useDeleteCourse();
  const isMyCourse = tab === 'my-course';
  const locationText = route.start_address_region ?? '위치 정보 없음';

  return (
    <Card
      type={isMyCourse ? 'my-course' : 'liked-course'}
      isLiked={!isMyCourse}
      title={route.title}
      location={locationText}
      distanceText={route.distanceText}
      likeCount={route.likeCount}
      onPrimaryActionClick={() => {
        if (isMyCourse) {
          router.push(ROUTES.COURSES.EDIT(route.id));
        } else {
          router.push(ROUTES.COURSES.DETAIL(route.id));
        }
      }}
      onSecondaryActionClick={() => {
        if (isMyCourse) {
          deleteCourse(route.id);
        }
      }}
      secondaryActionDisabled={isMyCourse && isDeleting}
    />
  );
}
