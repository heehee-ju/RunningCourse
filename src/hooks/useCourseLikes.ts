/**
 * useCourseLikes — 코스 찜 인증 제한, 상태 조회, 토글을 공통으로 처리한다.
 */
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ROUTES } from '@/commons/constants/url';
import { useAuth } from '@/commons/providers/auth/auth.provider';
import { useModal } from '@/commons/providers/modal/modal.provider';
import { fetchLikedCourseIds, setCourseLike } from '@/services/course/courseLikeService';

import type { User } from '@supabase/supabase-js';

type LikeCountsByCourseId = Record<string, number>;

function isGoogleUser(user: User | null): boolean {
  if (!user) return false;
  if (user.app_metadata?.provider === 'google') return true;
  return user.identities?.some((identity) => identity.provider === 'google') === true;
}

function clampLikeCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

export function useCourseLikes(initialLikeCounts: LikeCountsByCourseId) {
  const { user, isLoggedIn, isAnonymous, isLoading } = useAuth();
  const { openModal } = useModal();
  const router = useRouter();
  const pathname = usePathname();
  const [likedCourseIds, setLikedCourseIds] = useState<Set<string>>(new Set());
  const [optimisticLikeCounts, setOptimisticLikeCounts] = useState<LikeCountsByCourseId>({});

  const courseIds = useMemo(() => Object.keys(initialLikeCounts), [initialLikeCounts]);
  const courseIdsKey = useMemo(() => courseIds.join('|'), [courseIds]);
  const canUseCourseLike = isLoggedIn && !isAnonymous && isGoogleUser(user);

  useEffect(() => {
    if (isLoading) return;
    if (!canUseCourseLike || !user) {
      setLikedCourseIds(new Set());
      return;
    }

    let isMounted = true;

    const syncLikedCourses = async () => {
      const result = await fetchLikedCourseIds(user.id, courseIds);
      if (!isMounted) return;
      if (result.error) {
        console.error('[useCourseLikes] 찜 상태 조회 실패:', result.error);
        return;
      }
      setLikedCourseIds(result.data);
    };

    syncLikedCourses();

    return () => {
      isMounted = false;
    };
  }, [canUseCourseLike, courseIds, courseIdsKey, isLoading, user]);

  const openGoogleLoginConfirm = useCallback(() => {
    openModal({
      type: 'confirm',
      title:
        "'코스 찜하기'는 구글 로그인을 한 유저만 이용가능합니다. 구글 계정으로 로그인 하시겠습니까?",
      confirmText: '네',
      cancelText: '아니오',
      onConfirm: () => {
        router.push(`${ROUTES.LOGIN}?next=${encodeURIComponent(pathname || '/')}`);
      },
    });
  }, [openModal, pathname, router]);

  const isCourseLiked = useCallback(
    (courseId: string) => likedCourseIds.has(courseId),
    [likedCourseIds],
  );

  const getCourseLikeCount = useCallback(
    (courseId: string) =>
      optimisticLikeCounts[courseId] ?? clampLikeCount(initialLikeCounts[courseId] ?? 0),
    [initialLikeCounts, optimisticLikeCounts],
  );

  const toggleCourseLike = useCallback(
    async (courseId: string) => {
      if (isLoading) return;
      if (!canUseCourseLike || !user) {
        openGoogleLoginConfirm();
        return;
      }

      const wasLiked = likedCourseIds.has(courseId);
      const shouldLike = !wasLiked;
      const previousCount = getCourseLikeCount(courseId);
      const nextCount = clampLikeCount(previousCount + (shouldLike ? 1 : -1));

      setLikedCourseIds((previous) => {
        const next = new Set(previous);
        if (shouldLike) {
          next.add(courseId);
        } else {
          next.delete(courseId);
        }
        return next;
      });
      setOptimisticLikeCounts((previous) => ({ ...previous, [courseId]: nextCount }));

      const result = await setCourseLike(user.id, courseId, shouldLike);
      if (!result.error) {
        if (typeof result.likeCount === 'number') {
          setOptimisticLikeCounts((previous) => ({
            ...previous,
            [courseId]: result.likeCount ?? nextCount,
          }));
        }
        return;
      }

      console.error('[useCourseLikes] 찜 상태 변경 실패:', result.error);
      setLikedCourseIds((previous) => {
        const next = new Set(previous);
        if (wasLiked) {
          next.add(courseId);
        } else {
          next.delete(courseId);
        }
        return next;
      });
      setOptimisticLikeCounts((previous) => ({ ...previous, [courseId]: previousCount }));
    },
    [canUseCourseLike, getCourseLikeCount, isLoading, likedCourseIds, openGoogleLoginConfirm, user],
  );

  return { isCourseLiked, getCourseLikeCount, toggleCourseLike };
}
