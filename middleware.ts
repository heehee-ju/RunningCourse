import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { PRIVATE_DYNAMIC_PATTERNS, PRIVATE_ROUTES } from '@/commons/constants/url';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);

  const { pathname, search } = request.nextUrl;

  const isPrivate =
    (PRIVATE_ROUTES as readonly string[]).some((route) => route === pathname) ||
    PRIVATE_DYNAMIC_PATTERNS.some((pattern) => pattern.test(pathname));

  // private 라우트는 "세션 없음"만 차단한다. (게스트 세션은 허용)
  if (isPrivate && !user) {
    const loginUrl = new URL('/login', request.url);
    const redirectTo = `${pathname}${search}`;
    loginUrl.searchParams.set('redirect_to', redirectTo);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * 정적 에셋 및 내부 Next.js 경로를 제외한 모든 요청에 미들웨어를 적용한다.
     * - _next/static, _next/image: Next.js 내부 파일
     * - favicon.ico: 파비콘
     * - 이미지/폰트 확장자
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)',
  ],
};
