/**
 * Course Like Service — 코스 찜 상태 조회와 변경을 담당한다.
 */
import { createClient } from '@/lib/supabase/client';

type RouteLikeRow = {
  route_id: string;
};

export async function fetchLikedCourseIds(
  userId: string,
  courseIds: string[],
): Promise<{ data: Set<string>; error: Error | null }> {
  if (courseIds.length === 0) {
    return { data: new Set(), error: null };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('route_likes')
    .select('route_id')
    .eq('user_id', userId)
    .in('route_id', courseIds)
    .returns<RouteLikeRow[]>();

  if (error) {
    return { data: new Set(), error: new Error(error.message) };
  }

  return { data: new Set((data ?? []).map((row) => row.route_id)), error: null };
}
