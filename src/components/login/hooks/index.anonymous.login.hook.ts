'use client';

import { isRedirectError } from 'next/dist/client/components/redirect';
import { useCallback, useState } from 'react';

import { signInAnonymously } from '@/actions/auth.action';

interface UseAnonymousLoginOptions {
  returnTo?: string;
}

interface UseAnonymousLoginResult {
  trigger: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useAnonymousLogin({
  returnTo = '/',
}: UseAnonymousLoginOptions = {}): UseAnonymousLoginResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trigger = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await signInAnonymously(returnTo);

      // 성공 시 redirect()가 발생하여 컴포넌트 언마운트 — 이 블록은 오류 시만 실행
      if (result?.error) {
        setError(result.error);
        setIsLoading(false);
      }
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }
      setError('네트워크 오류가 발생했습니다.');
      setIsLoading(false);
    }
  }, [returnTo]);

  return { trigger, isLoading, error };
}
