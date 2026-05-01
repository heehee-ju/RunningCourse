// 코스 데이터 통신 전담
// Supabase와 통신하여 코스 데이터를 가져옴 (UI/Service에 Supabase 코드 금지)

import type { Route } from '@/commons/types/runroute';
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
  created_at: string | null;
};

const ROUTE_SELECT =
  'id, user_id, title, description, distance_meters, path_data, start_lat, start_lng, start_address_region, image_urls, likes_count, created_at';

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
