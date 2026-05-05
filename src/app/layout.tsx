import { Layout } from '@/commons/layout';
import { AuthProvider } from '@/commons/providers/auth/auth.provider';
import { ModalProvider } from '@/commons/providers/modal/modal.provider';
import { createClient } from '@/lib/supabase/server';
import { getUserRouteWriteCount } from '@/services/course/courseService';

import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: '루트런 | 내 주변 러닝 코스',
  description: '전국의 러닝 코스를 찾고, 나만의 경로를 기록하여 러너들과 공유해보세요.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let hasWrittenCourse = false;

  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error('[RootLayout] getUser 실패:', userError.message);
    }

    if (user?.is_anonymous === true) {
      const { count, error: countError } = await getUserRouteWriteCount(user.id);
      if (countError !== null || count === null) {
        if (countError) {
          console.error('[RootLayout] 게스트 코스 작성 횟수 조회 실패:', countError.message);
        }
        hasWrittenCourse = false;
      } else {
        hasWrittenCourse = count >= 1;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[RootLayout] 세션·코스 집계 초기화 중 오류:', message);
    hasWrittenCourse = false;
  }

  return (
    <html lang="ko">
      <head>
        {/* TMap SDK가 내부적으로 document.write를 사용해 동기 로드가 필요하다. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          id="tmap-vector-sdk"
          src={`https://apis.openapi.sk.com/tmap/vectorjs?version=1&appKey=${process.env.NEXT_PUBLIC_TMAP_API_KEY}`}
        />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <ModalProvider>
            <Layout hasWrittenCourse={hasWrittenCourse}>{children}</Layout>
          </ModalProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
