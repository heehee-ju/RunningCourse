'use server';

// 코스 관련 Server Actions
// 예) 좋아요 누르기, 코스 등록 폼 제출

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import * as courseRepository from '@/repositories/course.repository';
import { reverseGeocodeRegion } from '@/repositories/map.repository';
import * as courseService from '@/services/course/courseService';
import type { SubmitCourseInput } from '@/services/course/courseService';

export type CreateCourseActionError = {
  success: false;
  message: string;
};

type DeleteCourseActionResult = { success: true } | { success: false; error: string };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function toDistanceMetersSafe(km: number): number {
  if (!isFiniteNumber(km)) {
    throw new Error('지도에서 경로를 완전히 지정해 주세요.');
  }
  return Math.round(km * 1000);
}

/**
 * 클라이언트 폼에서 전달한 코스 데이터로 새 코스를 등록한다.
 * 성공 시 홈 캐시를 갱신한 뒤 `/`로 이동한다.
 */
export async function createCourseAction(
  input: SubmitCourseInput,
): Promise<CreateCourseActionError | void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      message: '로그인이 필요합니다.',
    };
  }

  const start_lat = input.routeData?.startPoint?.lat;
  const start_lng = input.routeData?.startPoint?.lng;

  if (!isFiniteNumber(start_lat) || !isFiniteNumber(start_lng)) {
    return {
      success: false,
      message: '지도에서 경로를 완전히 지정해 주세요.',
    };
  }

  const distance_meters = toDistanceMetersSafe(input.routeData.totalDistanceKm);

  let start_address_region: string | null = null;
  try {
    start_address_region = await reverseGeocodeRegion({
      lat: start_lat,
      lng: start_lng,
    });
  } catch (error) {
    console.error('[createCourseAction] 역지오코딩 실패:', error);
    start_address_region = null;
  }

  const { data, error } = await courseRepository.createRoute(supabase, {
    user_id: user.id,
    title: input.title,
    description: input.description ?? null,
    distance_meters,
    path_data: input.routeData.pathData,
    start_lat,
    start_lng,
    start_address_region,
    image_urls: input.imageUrls,
  });

  if (error || !data) {
    return {
      success: false,
      message: error?.message ?? '코스 등록에 실패했습니다.',
    };
  }

  revalidatePath('/');
  redirect('/');
}

export async function deleteCourseAction(routeId: string): Promise<DeleteCourseActionResult> {
  try {
    if (!routeId.trim()) {
      return {
        success: false,
        error: '유효하지 않은 코스 ID입니다.',
      };
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        error: '인증되지 않은 사용자입니다.',
      };
    }

    await courseService.deleteCourse(routeId, user.id);

    revalidatePath('/mypage');
    revalidatePath('/');

    return { success: true };
  } catch (error) {
    console.error('[deleteCourseAction] 코스 삭제 실패:', error);

    return {
      success: false,
      error:
        error instanceof Error ? error.message : '코스 삭제 중 알 수 없는 오류가 발생했습니다.',
    };
  }
}
