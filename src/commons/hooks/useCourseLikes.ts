/**
 * useCourseLikes — 코스 찜 인증 제한, 상태 조회, 토글을 공통으로 처리한다.
 */
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { toggleCourseLikeAction } from '@/actions/course.action';
import { ROUTES } from '@/commons/constants/url';
import { useAuth } from '@/commons/providers/auth/auth.provider';
import { useModal } from '@/commons/providers/modal/modal.provider';
import { useToast } from '@/commons/providers/toast/toast.provider';
import { fetchLikedCourseIds } from '@/services/course/courseLikeService';

type LikeCountsByCourseId = Record<string, number>;

function clampLikeCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

export function useCourseLikes(initialLikeCounts: LikeCountsByCourseId) {
  const { user, isLoggedIn, isLoading } = useAuth();
  const { openModal } = useModal();
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [likedCourseIds, setLikedCourseIds] = useState<Set<string>>(new Set());
  const [optimisticLikeCounts, setOptimisticLikeCounts] = useState<LikeCountsByCourseId>({});

  const courseIds = useMemo(() => Object.keys(initialLikeCounts), [initialLikeCounts]);
  const courseIdsKey = useMemo(() => courseIds.join('|'), [courseIds]);
  const canUseCourseLike = isLoggedIn;

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
      title: "'코스 좋아요'는 로그인한 유저만 이용가능합니다. 로그인 하시겠습니까?",
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
    (courseId: string) => {
      const count =
        optimisticLikeCounts[courseId] ?? clampLikeCount(initialLikeCounts[courseId] ?? 0);
      return likedCourseIds.has(courseId) ? Math.max(1, count) : count;
    },
    [initialLikeCounts, likedCourseIds, optimisticLikeCounts],
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

      const result = await toggleCourseLikeAction(courseId, shouldLike, pathname !== '/mypage');
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
      showToast('좋아요 처리에 실패했습니다.', 'failed');
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
    [
      canUseCourseLike,
      getCourseLikeCount,
      isLoading,
      likedCourseIds,
      openGoogleLoginConfirm,
      pathname,
      showToast,
      user,
    ],
  );

  return { isCourseLiked, getCourseLikeCount, toggleCourseLike };
}
