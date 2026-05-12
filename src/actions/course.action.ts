'use server';

// 코스 관련 Server Actions
// 예) 좋아요 누르기, 코스 등록 폼 제출

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { Route } from '@/commons/types/runroute';
import { createClient } from '@/lib/supabase/server';
import * as courseRepository from '@/repositories/course/course.repository';
import { reverseGeocodeRegion } from '@/repositories/map.repository';
import * as courseService from '@/services/course/courseService';
import type { SubmitCourseInput } from '@/services/course/courseService';

export type CreateCourseActionError = {
  success: false;
  message: string;
};

type DeleteCourseActionResult = { success: true } | { success: false; error: string };

/** 코스 메타데이터(제목·설명·이미지) 수정 시 서버 액션 입력 */
export type UpdateCourseActionInput = {
  courseId: string;
  title: string;
  description: string | null;
  image_urls: string[];
};

export type UpdateCourseActionResult =
  | { success: true; data: Route }
  | { success: false; error: string };

export type ToggleCourseLikeActionResult = { likeCount: number | null; error: string | null };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}

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
 * 코스 좋아요 상태를 토글한다.
 * revalidateMypage=true 일 때만 `/mypage` Router Cache를 무효화한다.
 * 마이페이지에서 호출할 때는 false를 넘겨 즉각적인 카드 제거를 막는다.
 */
export async function toggleCourseLikeAction(
  courseId: string,
  shouldLike: boolean,
  revalidateMypage = true,
): Promise<ToggleCourseLikeActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { likeCount: null, error: '로그인이 필요합니다.' };
  }

  if (shouldLike) {
    const { error } = await courseRepository.upsertRouteLike(supabase, user.id, courseId);
    if (error) return { likeCount: null, error: error.message };
  } else {
    const { error } = await courseRepository.deleteRouteLike(supabase, user.id, courseId);
    if (error) return { likeCount: null, error: error.message };
  }

  const { count, error: countError } = await courseRepository.getRouteLikeCount(supabase, courseId);
  if (countError) return { likeCount: null, error: countError.message };

  const nextLikeCount = count ?? 0;
  const { error: updateError } = await courseRepository.updateRouteLikesCount(
    supabase,
    courseId,
    nextLikeCount,
  );
  if (updateError) return { likeCount: null, error: updateError.message };

  if (revalidateMypage) {
    revalidatePath('/mypage');
  }

  return { likeCount: nextLikeCount, error: null };
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
    is_round_trip: Boolean(input.routeData.isRoundTrip),
  });

  if (error || !data) {
    return {
      success: false,
      message: error?.message ?? '코스 등록에 실패했습니다.',
    };
  }

  revalidatePath('/');
  redirect(`/courses/${data.id}`);
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

/**
 * 기존 코스 게시글의 제목·설명·이미지를 수정한다.
 * 성공 시 상세·목록 경로 캐시를 무효화한다.
 */
export async function updateCourseAction(
  input: UpdateCourseActionInput,
): Promise<UpdateCourseActionResult> {
  const { courseId, title, description, image_urls } = input;

  if (!courseId?.trim() || !isValidUuid(courseId)) {
    return { success: false, error: '유효하지 않은 코스 ID입니다.' };
  }

  const trimmedTitle = typeof title === 'string' ? title.trim() : '';
  if (!trimmedTitle) {
    return { success: false, error: '제목을 입력해 주세요.' };
  }

  if (!Array.isArray(image_urls)) {
    return { success: false, error: '이미지 URL 목록 형식이 올바르지 않습니다.' };
  }

  if (!image_urls.every((url): url is string => typeof url === 'string')) {
    return { success: false, error: '이미지 URL 목록 형식이 올바르지 않습니다.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: '로그인이 필요합니다.' };
  }

  const normalizedDescription =
    typeof description === 'string' && description.trim().length > 0 ? description.trim() : null;

  const id = courseId.trim();

  const { data, error } = await courseService.updateCourse(
    supabase,
    {
      courseId: id,
      title: trimmedTitle,
      description: normalizedDescription,
      image_urls,
    },
    user.id,
  );

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? '코스 수정에 실패했습니다.',
    };
  }

  revalidatePath(`/courses/${id}`);
  revalidatePath('/courses');

  return { success: true, data };
}
