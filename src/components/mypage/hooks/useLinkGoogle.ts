'use client';

import { isRedirectError } from 'next/dist/client/components/redirect';
import { useCallback, useTransition } from 'react';

import { linkGoogleAccount } from '@/actions/auth.action';
import { useToast } from '@/commons/providers/toast/toast.provider';

type UseLinkGoogleOptions = {
  /** OAuth 완료 후 돌아올 경로 (기본 `/`) */
  returnTo?: string;
};

type UseLinkGoogleResult = {
  linkGoogle: () => void;
  isPending: boolean;
};

export function useLinkGoogle({ returnTo = '/' }: UseLinkGoogleOptions = {}): UseLinkGoogleResult {
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const linkGoogle = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await linkGoogleAccount(returnTo);
        if (result?.error) {
          showToast(result.error, 'failed');
        }
      } catch (error) {
        if (isRedirectError(error)) {
          throw error;
        }
        showToast(
          error instanceof Error ? error.message : '구글 계정 연동에 실패했습니다.',
          'failed',
        );
      }
    });
  }, [returnTo, showToast]);

  return { linkGoogle, isPending };
}
