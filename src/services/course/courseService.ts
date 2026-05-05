// 코스 비즈니스 로직
// 데이터 가공, 권한 체크 등

import type { MypageRouteCardData } from '@/commons/types/mypage';
import type { Route } from '@/commons/types/runroute';
import * as courseRepository from '@/repositories/course/course.repository';
import type {
  InsertRouteParams,
  UpdateCourseParams,
} from '@/repositories/course/course.repository';

import type { SupabaseClient } from '@supabase/supabase-js';

/** DB insert 직전 검증에 사용하는 경로 요약 (지도에서 확정된 경로) */
export type SubmitCourseRouteData = {
  /** km 단위 */
  totalDistanceKm: number;
  pathData: Record<string, unknown>;
  startPoint: { lat: number; lng: number };
};

/** UI에서 코스 등록 시 전달하는 입력 */
export type SubmitCourseInput = {
  title: string;
  description?: string | null;
  routeData: SubmitCourseRouteData;
  imageUrls: string[];
};

function assertRouteDataForDb(routeData: SubmitCourseRouteData | undefined | null): void {
  if (!routeData) {
    throw new Error('지도에서 경로를 완전히 지정해 주세요.');
  }

  const { startPoint, totalDistanceKm } = routeData;

  const latOk =
    startPoint &&
    typeof startPoint.lat === 'number' &&
    typeof startPoint.lng === 'number' &&
    Number.isFinite(startPoint.lat) &&
    Number.isFinite(startPoint.lng);

  if (!latOk) {
    throw new Error('지도에서 경로를 완전히 지정해 주세요.');
  }

  if (typeof totalDistanceKm !== 'number' || !Number.isFinite(totalDistanceKm)) {
    throw new Error('지도에서 경로를 완전히 지정해 주세요.');
  }
}

/** km → m(정수). NaN·비유한 값은 검증 단계에서 걸러야 한다. */
function toDistanceMetersSafe(km: number): number {
  const n = Number(km);
  if (!Number.isFinite(n)) {
    throw new Error('지도에서 경로를 완전히 지정해 주세요.');
  }
  const meters = Math.round(n * 1000);
  if (!Number.isFinite(meters)) {
    throw new Error('지도에서 경로를 완전히 지정해 주세요.');
  }
  return meters;
}

function routeToMypageCard(route: Route): MypageRouteCardData {
  return {
    id: route.id,
    title: route.title,
    start_address_region: route.start_address_region ?? null,
    distanceText: `${(route.distance_meters / 1000).toFixed(1)}km`,
    likeCount: route.likes_count,
  };
}

/**
 * 마이페이지용: 내 코스·좋아요 코스를 병렬로 조회해 카드 뷰 모델로 반환한다.
 */
export async function fetchMypageRouteLists(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  myRoutes: MypageRouteCardData[];
  likedRoutes: MypageRouteCardData[];
}> {
  const [myResult, likedResult] = await Promise.all([
    courseRepository.getRoutesByUserId(supabase, userId),
    courseRepository.getLikedRoutesByUserId(supabase, userId),
  ]);

  if (myResult.error) {
    console.error('[courseService] 내 코스 조회 실패:', myResult.error);
  }
  if (likedResult.error) {
    console.error('[courseService] 좋아요 코스 조회 실패:', likedResult.error);
  }

  return {
    myRoutes: myResult.data.map(routeToMypageCard),
    likedRoutes: likedResult.data.map(routeToMypageCard),
  };
}

/**
 * 인증된 사용자로 새 코스를 등록한다.
 * 거리(km)를 m(정수)로 변환하고 `InsertRouteParams`에 매핑한다.
 */
export async function submitNewCourse(
  supabase: SupabaseClient,
  input: SubmitCourseInput,
): Promise<{ data: Route | null; error: Error | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new Error('로그인이 필요합니다.') };
  }

  assertRouteDataForDb(input.routeData);

  const distance_meters = toDistanceMetersSafe(input.routeData.totalDistanceKm);

  const payload: InsertRouteParams = {
    user_id: user.id,
    title: input.title,
    description: input.description ?? null,
    distance_meters,
    path_data: input.routeData.pathData,
    start_lat: input.routeData.startPoint.lat,
    start_lng: input.routeData.startPoint.lng,
    image_urls: input.imageUrls,
  };

  return courseRepository.createCourse(supabase, payload);
}

export async function deleteCourse(routeId: string, userId: string): Promise<void> {
  await courseRepository.deleteRoute(routeId, userId);
}

/**
 * 코스 메타데이터(제목·설명·이미지) 갱신. 리포지토리에서 본인 행만 갱신되도록 위임한다.
 */
export async function updateCourse(
  supabase: SupabaseClient,
  data: Omit<UpdateCourseParams, 'userId'>,
  userId: string,
): Promise<{ data: Route | null; error: Error | null }> {
  return courseRepository.updateCourse(supabase, { ...data, userId });
}

/**
 * 유저가 작성한 코스(`routes`) 행 개수를 조회한다.
 * 리포지토리 예외는 잡아 로깅하고, 호출부는 `error`로 실패 여부를 판단할 수 있다.
 */
export async function getUserRouteWriteCount(userId: string): Promise<{
  /** 성공 시 작성 코스 개수, 실패 시 null */
  count: number | null;
  /** 실패 시 에러, 성공 시 null */
  error: Error | null;
}> {
  // 리포지토리가 던질 수 있는 오류를 서비스에서 일괄 처리한다.
  try {
    // 데이터 통신(집계)은 리포지토리에만 둔다.
    const routeCount = await courseRepository.getRouteCountByUserId(userId);
    // 집계 성공: 유효한 숫자와 error: null을 돌려준다.
    return { count: routeCount, error: null };
  } catch (err) {
    // throw된 값이 Error가 아닐 수 있어 표준 Error로 감싼다.
    const error = err instanceof Error ? err : new Error(String(err));
    // 디버깅·모니터링을 위해 실패 맥락을 콘솔에 남긴다.
    console.error('[courseService] 유저 코스 작성 횟수 조회 실패:', error);
    // 실패 시 count는 사용하지 말 것을 명시하기 위해 null을 반환한다.
    return { count: null, error };
  }
}
