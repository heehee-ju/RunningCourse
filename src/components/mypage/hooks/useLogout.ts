'use client';

import { useCallback, useState } from 'react';

import { deleteGuestAccount, signOut } from '@/actions/auth.action';
import { useToast } from '@/commons/providers/toast/toast.provider';

interface UseLogoutResult {
  executeLogoutOrDelete: (isAnonymous: boolean) => Promise<void>;
  isPending: boolean;
  isError: boolean;
}

export function useLogout(): UseLogoutResult {
  const [isPending, setIsPending] = useState(false);
  const [isError, setIsError] = useState(false);
  const { showToast } = useToast();

  const executeLogoutOrDelete = useCallback(
    async (isAnonymous: boolean) => {
      setIsPending(true);
      setIsError(false);

      try {
        const result = isAnonymous ? await deleteGuestAccount() : await signOut();
        if (result?.error) {
          console.error(
            isAnonymous ? '[useLogout] 게스트 계정 삭제 실패:' : '[useLogout] 로그아웃 실패:',
            result.error,
          );
          showToast(
            isAnonymous ? '게스트 계정 삭제에 실패했습니다.' : '로그아웃에 실패했습니다.',
            'failed',
          );
          setIsError(true);
          setIsPending(false);
          return;
        }
        // 성공 시 redirect('/login')이 발생하여 컴포넌트 언마운트
      } catch (err) {
        console.error(
          isAnonymous ? '[useLogout] 게스트 계정 삭제 중 예외:' : '[useLogout] 로그아웃 중 예외:',
          err,
        );
        showToast(
          isAnonymous ? '게스트 계정 삭제에 실패했습니다.' : '로그아웃에 실패했습니다.',
          'failed',
        );
        setIsError(true);
        setIsPending(false);
      }
    },
    [showToast],
  );

  return { executeLogoutOrDelete, isPending, isError };
}
