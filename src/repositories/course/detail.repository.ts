/**
 * Course Detail Repository — 코스 상세 페이지 데이터 통신 전담
 * - Supabase로 `routes` 테이블에서 코스를 조회한다.
 */
import type { Route } from '@/commons/types/runroute';

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
  image_urls: string[] | null;
  likes_count: number | null;
  is_round_trip: boolean | null;
  created_at: string | null;
};

const ROUTE_SELECT =
  'id, user_id, title, description, distance_meters, path_data, start_lat, start_lng, image_urls, likes_count, is_round_trip, created_at';

function toRoute(row: RouteRow | null): Route | null {
  if (!row) return null;

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
    image_urls: row.image_urls ?? [],
    likes_count: row.likes_count ?? 0,
    is_round_trip: row.is_round_trip ?? false,
    created_at: row.created_at,
  };
}

/**
 * `routes` 테이블에서 코스 id로 단건 조회한다.
 */
export async function getRouteById(
  supabase: SupabaseClient,
  routeId: string,
): Promise<{ data: Route | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('routes')
    .select(ROUTE_SELECT)
    .eq('id', routeId)
    .maybeSingle<RouteRow>();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: toRoute(data ?? null), error: null };
}
