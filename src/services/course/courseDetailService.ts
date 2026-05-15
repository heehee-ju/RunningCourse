/**
 * Course Detail Service — 코스 상세 페이지에서 필요한 데이터를 조합한다.
 */
import { cache } from 'react';

import type { Route } from '@/commons/types/routerun';
import { createClient } from '@/lib/supabase/server';
import * as courseDetailRepository from '@/repositories/course/detail.repository';
import * as userRepository from '@/repositories/user.repository';
import { reverseGeocodeRegionForHome } from '@/services/map/mapService';

export type CourseDetailPayload = {
  course: Route;
  authorNickname: string;
  location: string;
};

export const fetchCourseDetail = cache(
  async (courseId: string): Promise<CourseDetailPayload | null> => {
    const supabase = createClient();

    const routeResult = await courseDetailRepository.getRouteById(supabase, courseId);
    if (routeResult.error) {
      console.error('[courseDetailService] 코스 조회 실패:', routeResult.error);
      throw routeResult.error;
    }

    const course = routeResult.data;
    if (!course) return null;

    // DB에 저장된 start_address_region을 우선 사용해 TMap API 재호출을 줄인다.
    const locationFromDb = course.start_address_region ?? null;

    const [profileResult, location] = await Promise.all([
      userRepository.getUserProfileById(supabase, course.user_id),
      locationFromDb
        ? Promise.resolve(locationFromDb)
        : reverseGeocodeRegionForHome({ lat: course.start_lat, lng: course.start_lng }),
    ]);

    const authorNickname = profileResult.data?.nickname?.trim() || '작성자';
    return {
      course,
      authorNickname,
      location: location ?? '위치 정보 없음',
    };
  },
);
