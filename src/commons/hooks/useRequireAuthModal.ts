'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { PRIVATE_ROUTES, ROUTES } from '@/commons/constants/url';
import { useAuth } from '@/commons/providers/auth/auth.provider';
import { useModal } from '@/commons/providers/modal/modal.provider';

type RequireAuthOptions = {
  redirectTo: string;
  title?: string;
};

const DEFAULT_MODAL_TITLE = '로그인이 필요한 서비스입니다.';

export function useRequireAuthModal() {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useAuth();
  const { openModal } = useModal();

  const requireAuth = useCallback(
    ({ redirectTo, title = DEFAULT_MODAL_TITLE }: RequireAuthOptions): boolean => {
      if (isLoading) {
        return false;
      }

      if (isLoggedIn) {
        return true;
      }

      openModal({
        type: 'alert',
        title,
        confirmText: '확인',
        onConfirm: () => {
          const loginPath = `${ROUTES.LOGIN}?redirect_to=${encodeURIComponent(redirectTo)}`;
          router.push(loginPath);
        },
      });
      return false;
    },
    [isLoggedIn, isLoading, openModal, router],
  );

  const isPrivateRoute = useCallback((path: string): boolean => {
    return (PRIVATE_ROUTES as readonly string[]).includes(path);
  }, []);

  return {
    requireAuth,
    isPrivateRoute,
  };
}
