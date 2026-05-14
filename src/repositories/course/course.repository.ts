// 코스 데이터 통신 전담
// Supabase와 통신하여 코스 데이터를 가져옴 (UI/Service에 Supabase 코드 금지)

import type { Route } from '@/commons/types/routerun';
import { createClient } from '@/lib/supabase/server';

import type { SupabaseClient } from '@supabase/supabase-js';

type RouteRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  distance_meters: number | null;
  path_data: Record<string, unknown> | null;
  start_lat: number | null;
  start_lng: number | null;
  start_address_region: string | null;
  image_urls: string[] | null;
  likes_count: number | null;
  is_round_trip: boolean | null;
  created_at: string | null;
};

const ROUTE_SELECT =
  'id, user_id, title, description, distance_meters, path_data, start_lat, start_lng, start_address_region, image_urls, likes_count, is_round_trip, created_at';

function toRoute(row: RouteRow): Route | null {
  if (
    !row.id ||
    !row.user_id ||
    !row.title ||
    row.distance_meters === null ||
    row.start_lat === null ||
    row.start_lng === null ||
    !row.created_at
  ) {
    return null;
  }

  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description ?? undefined,
    distance_meters: row.distance_meters,
    path_data: row.path_data ?? {},
    start_lat: row.start_lat,
    start_lng: row.start_lng,
    start_address_region: row.start_address_region,
    image_urls: row.image_urls ?? [],
    likes_count: row.likes_count ?? 0,
    is_round_trip: row.is_round_trip ?? false,
    created_at: row.created_at,
  };
}

function normalizeRouteRows(rows: RouteRow[] | null): Route[] {
  return (rows ?? []).map(toRoute).filter((route): route is Route => route !== null);
}

/** `routes` 테이블 insert 시 사용 (스키마: public.routes) */
export interface InsertRouteParams {
  user_id: string;
  title: string;
  description: string | null;
  distance_meters: number;
  path_data: Record<string, unknown>;
  start_lat: number;
  start_lng: number;
  start_address_region?: string | null;
  image_urls: string[];
  is_round_trip: boolean;
}

/**
 * 새 코스를 `routes`에 저장하고, 생성된 행을 조회 모델(`Route`)로 반환한다.
 */
export async function createRoute(
  supabase: SupabaseClient,
  params: InsertRouteParams,
): Promise<{ data: Route | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('routes')
    .insert(params)
    .select(ROUTE_SELECT)
    .single()
    .returns<RouteRow>();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: toRoute(data), error: null };
}

export const createCourse = createRoute;

/** `routes` 테이블에서 제목·설명·이미지 등 메타데이터만 갱신할 때 사용 */
export interface UpdateCourseParams {
  courseId: string;
  userId: string;
  title: string;
  description: string | null;
  image_urls: string[];
}

/**
 * 주어진 코스의 title, description, image_urls, updated_at을 갱신하고
 * 갱신된 행을 조회 모델(`Route`)로 반환한다.
 */
export async function updateCourse(
  supabase: SupabaseClient,
  params: UpdateCourseParams,
): Promise<{ data: Route | null; error: Error | null }> {
  const { courseId, userId, title, description, image_urls } = params;

  const { data, error } = await supabase
    .from('routes')
    .update({
      title,
      description,
      image_urls,
      updated_at: new Date().toISOString(),
    })
    .eq('id', courseId)
    .eq('user_id', userId)
    .select(ROUTE_SELECT)
    .single()
    .returns<RouteRow>();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: toRoute(data), error: null };
}

/** 현재 유저가 작성한 코스(`routes.user_id`) 목록 */
export async function getRoutesByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: Route[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('routes')
    .select(ROUTE_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .returns<RouteRow[]>();

  if (error) {
    return { data: [], error: new Error(error.message) };
  }

  return { data: normalizeRouteRows(data), error: null };
}

type LikedRouteJoinRow = {
  routes: RouteRow | RouteRow[] | null;
};

/**
 * `route_likes`와 `routes`를 inner join하여 좋아요한 코스만 조회한다.
 * PostgREST: `routes!inner(...)` 로 매칭되는 행만 반환한다.
 */
export async function getLikedRoutesByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: Route[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('route_likes')
    .select(`routes!inner(${ROUTE_SELECT})`)
    .eq('user_id', userId)
    .returns<LikedRouteJoinRow[]>();

  if (error) {
    return { data: [], error: new Error(error.message) };
  }

  const routeRows: RouteRow[] = [];
  for (const row of data ?? []) {
    const nested = row.routes;
    if (Array.isArray(nested)) {
      routeRows.push(...nested);
    } else if (nested) {
      routeRows.push(nested);
    }
  }

  return { data: normalizeRouteRows(routeRows), error: null };
}

/**
 * 특정 유저가 `routes` 테이블에 작성한 코스(행)의 총 개수를 조회한다.
 * 서버 전용 Supabase 클라이언트로 질의하며, UI·비즈니스 규칙은 포함하지 않는다.
 */
export async function getRouteCountByUserId(userId: string): Promise<number> {
  // 요청·응답 쿠키를 반영하는 서버 사이드 Supabase 인스턴스를 만든다.
  const supabase = createClient();
  // `routes` 테이블을 대상으로 집계 쿼리를 준비한다.
  const { count, error } = await supabase
    .from('routes')
    // 행 데이터는 가져오지 않고(`head: true`) 정확한 건수(`count: 'exact'`)만 요청한다.
    .select('*', { count: 'exact', head: true })
    // 주어진 UUID와 일치하는 작성자의 코스만 센다.
    .eq('user_id', userId);

  // Supabase/PostgREST가 에러 객체를 돌려주면 통신 실패로 본다.
  if (error) {
    // 메시지를 유지한 예외로 올려 서비스 계층에서 일관되게 처리하게 한다.
    throw new Error(error.message);
  }

  // 집계가 비어 있으면 null일 수 있어, 숫자 비교에 안전한 0으로 치환한다.
  return count ?? 0;
}

export async function upsertRouteLike(
  supabase: SupabaseClient,
  userId: string,
  routeId: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('route_likes')
    .upsert({ user_id: userId, route_id: routeId }, { onConflict: 'user_id,route_id' });

  return { error: error ? new Error(error.message) : null };
}

export async function deleteRouteLike(
  supabase: SupabaseClient,
  userId: string,
  routeId: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('route_likes')
    .delete()
    .eq('user_id', userId)
    .eq('route_id', routeId);

  return { error: error ? new Error(error.message) : null };
}

export async function getRouteLikeCount(
  supabase: SupabaseClient,
  routeId: string,
): Promise<{ count: number | null; error: Error | null }> {
  const { count, error } = await supabase
    .from('route_likes')
    .select('*', { count: 'exact', head: true })
    .eq('route_id', routeId);

  return { count: count ?? null, error: error ? new Error(error.message) : null };
}

export async function updateRouteLikesCount(
  supabase: SupabaseClient,
  routeId: string,
  likesCount: number,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('routes')
    .update({ likes_count: likesCount })
    .eq('id', routeId);

  return { error: error ? new Error(error.message) : null };
}

export async function deleteRoute(routeId: string, userId: string): Promise<void> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('routes')
    .delete()
    .eq('id', routeId)
    .eq('user_id', userId)
    .select('id')
    .returns<{ id: string }[]>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    throw new Error('삭제할 코스를 찾을 수 없거나 삭제 권한이 없습니다.');
  }
}
