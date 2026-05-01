'use server';

import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

/** 게스트 계정 삭제 실패 시 서버 액션이 반환하는 형태 (성공 시에는 redirect로 응답이 끝나므로 반환되지 않음) */
export type DeleteGuestAccountError = { error: string };

function isRelativePath(path: unknown): path is string {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');
}

/**
 * Google OAuth URL을 발급하고 브라우저를 Google 로그인 페이지로 리다이렉트한다.
 * 콜백은 /auth/callback?next={returnTo} 로 돌아온다.
 */
export async function signInWithGoogle(returnTo: string = '/'): Promise<{ error: string } | void> {
  const supabase = createClient();
  const origin = headers().get('origin') ?? '';
  const safeReturnTo = isRelativePath(returnTo) ? returnTo : '/';
  const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(safeReturnTo)}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl,
    },
  });

  if (error || !data.url) {
    return { error: error?.message ?? 'OAuth URL 발급 실패' };
  }

  redirect(data.url);
}

/**
 * 익명 세션을 서버에서 생성하고 쿠키를 설정한 뒤 대상 경로로 리다이렉트한다.
 */
export async function signInAnonymously(returnTo: string = '/'): Promise<{ error: string } | void> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInAnonymously();

  if (error) {
    return { error: error.message };
  }

  const safeReturnTo = isRelativePath(returnTo) ? returnTo : '/';
  redirect(safeReturnTo);
}

/**
 * 현재 세션을 종료하고 로그인 페이지로 리다이렉트한다.
 */
export async function signOut(): Promise<{ error: string } | void> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: error.message };
  }

  // Supabase Auth 쿠키를 한 번 더 정리해 세션 잔존 가능성을 낮춘다.
  const cookieStore = cookies();
  cookieStore
    .getAll()
    .filter((cookie) => cookie.name.startsWith('sb-'))
    .forEach((cookie) => cookieStore.delete(cookie.name));

  redirect('/login');
}

/**
 * 현재 로그인된 게스트(익명) 계정을 Auth에서 영구 삭제하고 로그인 페이지로 보낸다.
 * Service Role은 서버에서만 사용하며 브라우저 번들에 포함되지 않는다.
 */
export async function deleteGuestAccount(): Promise<DeleteGuestAccountError | void> {
  // 1) SSR용 Supabase 클라이언트로 쿠키 기반 세션에서 현재 사용자 정보를 조회한다.
  const supabase = createClient();
  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser();

  // 2) 세션 조회 자체가 실패한 경우 — 삭제 대상을 특정할 수 없으므로 에러로 종료한다.
  if (sessionError) {
    return { error: sessionError.message };
  }

  // 3) 로그인된 사용자가 없으면 삭제할 계정이 없다.
  if (!user?.id) {
    return { error: '삭제할 계정의 세션이 없습니다.' };
  }

  // 3a) 익명(게스트) 세션이 아니면 Admin 삭제 API를 호출하지 않는다.
  if (user.is_anonymous !== true) {
    console.error(
      '[deleteGuestAccount] 일반 사용자가 게스트 계정 삭제 경로로 접근 시도함:',
      user.id,
    );
    return { error: '일반 사용자는 이 접근 방식을 통해 계정을 삭제할 수 없습니다.' };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 4) Admin API 호출에 필요한 환경 변수가 비어 있으면 안전하게 중단한다 (키는 서버 전용).
  if (!supabaseUrl || !serviceRoleKey) {
    return { error: '서버 설정이 올바르지 않아 계정을 삭제할 수 없습니다.' };
  }

  // 5) @supabase/supabase-js의 createClient로 Service Role 전용 Admin 클라이언트를 만든다 (클라이언트에 노출 금지).
  const adminClient = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // 6) GoTrue Admin API로 해당 유저를 Auth에서 완전히 제거한다.
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

  // 7) 삭제 API가 실패하면 원인 메시지를 한글 맥락과 함께 반환한다.
  if (deleteError) {
    return { error: deleteError.message };
  }

  // 8) 삭제 후에도 브라우저에 남을 수 있는 Supabase 세션 쿠키를 정리한다 (signOut과 동일).
  const cookieStore = cookies();
  cookieStore
    .getAll()
    .filter((cookie) => cookie.name.startsWith('sb-'))
    .forEach((cookie) => cookieStore.delete(cookie.name));

  // 9) 로그인 화면으로 이동시킨다 (redirect는 내부적으로 throw를 사용한다).
  redirect('/login');
}
