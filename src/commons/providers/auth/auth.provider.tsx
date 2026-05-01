'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

import type { User } from '@supabase/supabase-js';

// ─── JWT 기반 익명 사용자 판별 ──────────────────────────────────────────────────

function extractIsAnonymous(user: User | null): boolean {
  if (!user) return false;
  return user.is_anonymous === true;
}

// ─── 타입 ──────────────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null;
  /** 세션 존재 여부(익명 포함) */
  isLoggedIn: boolean;
  /** 정식 인증 여부(익명 제외) */
  isAuthenticated: boolean;
  /** 익명 사용자 여부 */
  isAnonymous: boolean;
  isLoading: boolean;
}

export type AuthContextValue = AuthState;

// ─── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoggedIn: false,
    isAuthenticated: false,
    isAnonymous: false,
    isLoading: true,
  });

  useEffect(() => {
    const supabase = createClient();

    const buildAuthState = (user: User | null): AuthState => {
      const isAnonymous = extractIsAnonymous(user);
      return {
        user,
        isLoggedIn: !!user,
        isAuthenticated: !!user && !isAnonymous,
        isAnonymous,
        isLoading: false,
      };
    };

    // 앱 마운트 시 쿠키 기반 세션 초기 확인
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAuthState(buildAuthState(user));
    });

    // 쿠키 기반 세션 변화(로그인·로그아웃·토큰 갱신) 감지
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setAuthState(buildAuthState(user));
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ ...authState }), [authState]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.');
  }
  return ctx;
}
