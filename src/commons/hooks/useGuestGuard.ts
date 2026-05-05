'use client';

import { useCallback } from 'react';

import { useAuth } from '@/commons/providers/auth/auth.provider';
import { useModal } from '@/commons/providers/modal/modal.provider';

/** 프로필 수정 — 게스트 차단 시 모달 제목 */
const MODAL_TITLE_PROFILE = '닉네임 변경은 구글 연동 후 가능합니다';

/** 코스 등록 — 게스트 1회 작성 제한 안내 모달 제목 */
const MODAL_TITLE_COURSE_ONCE = '추가 등록은 구글 연동 후 가능합니다';

/**
 * 게스트(익명) 세션과 구글 연동 완료 계정의 권한을 구분하는 가드 훅.
 *
 * - `useAuth().isAnonymous`로 게스트 여부를 판별합니다.
 * - 차단 시 전역 모달로만 안내하고, 확인 후에도 현재 페이지에 머무릅니다.
 */
export function useGuestGuard() {
  const { isAnonymous, isLoading } = useAuth();
  const { openModal } = useModal();

  /**
   * 프로필 수정 등 닉네임 변경이 필요한 동작용 가드.
   * - 정식 회원(비익명): `onPass` 즉시 실행
   * - 게스트: 안내 모달만 열고 `onPass`는 호출하지 않음
   */
  const requireFullAccountForProfile = useCallback(
    (onPass: () => void) => {
      if (isLoading) {
        return;
      }
      if (!isAnonymous) {
        onPass();
        return;
      }
      openModal({
        type: 'alert',
        title: MODAL_TITLE_PROFILE,
        confirmText: '확인',
      });
    },
    [isAnonymous, isLoading, openModal],
  );

  /**
   * 코스 작성/등록 진입용 가드.
   * - 게스트이면서 이미 코스를 작성한 경우: 제한 모달
   * - 그 외(정식 회원이거나, 게스트이지만 아직 미작성): `onPass` 실행
   */
  const requireFullAccountForCourse = useCallback(
    (hasWrittenCourse: boolean, onPass: () => void) => {
      if (isLoading) {
        return;
      }
      if (isAnonymous && hasWrittenCourse) {
        openModal({
          type: 'alert',
          title: MODAL_TITLE_COURSE_ONCE,
          confirmText: '확인',
        });
        return;
      }
      onPass();
    },
    [isAnonymous, isLoading, openModal],
  );

  return {
    requireFullAccountForProfile,
    requireFullAccountForCourse,
  };
}
