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

export async function setCourseLike(
  userId: string,
  courseId: string,
  shouldLike: boolean,
): Promise<{ likeCount: number | null; error: Error | null }> {
  const supabase = createClient();

  if (shouldLike) {
    const { error } = await supabase
      .from('route_likes')
      .upsert({ user_id: userId, route_id: courseId }, { onConflict: 'user_id,route_id' });

    if (error) {
      return { likeCount: null, error: new Error(error.message) };
    }
  } else {
    const { error } = await supabase
      .from('route_likes')
      .delete()
      .eq('user_id', userId)
      .eq('route_id', courseId);

    if (error) {
      return { likeCount: null, error: new Error(error.message) };
    }
  }

  const { count, error: countError } = await supabase
    .from('route_likes')
    .select('*', { count: 'exact', head: true })
    .eq('route_id', courseId);

  if (countError) {
    return { likeCount: null, error: new Error(countError.message) };
  }

  const nextLikeCount = count ?? 0;
  const { error: updateError } = await supabase
    .from('routes')
    .update({ likes_count: nextLikeCount })
    .eq('id', courseId);

  if (updateError) {
    return { likeCount: null, error: new Error(updateError.message) };
  }

  return { likeCount: nextLikeCount, error: null };
}
