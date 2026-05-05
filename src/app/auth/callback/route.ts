import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

function isRelativePath(path: unknown): path is string {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next');
  const next = isRelativePath(rawNext) ? rawNext : '/';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && user.is_anonymous === false) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ is_anonymous: false })
          .eq('id', user.id);

        if (updateError) {
          console.error('Failed to update user anonymity status:', updateError);
        }
      }

      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
}
