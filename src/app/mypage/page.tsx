import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { ROUTES } from '@/commons/constants/url';
import Mypage from '@/components/mypage';
import { createClient } from '@/lib/supabase/server';
import { getMypagePageData } from '@/services/user/userService';

export default async function MypagePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(ROUTES.MYPAGE)}`);
  }

  const meta = user.user_metadata;
  const fullName = typeof meta?.full_name === 'string' ? meta.full_name : null;
  const shortName = typeof meta?.name === 'string' ? meta.name : null;
  const fallbackDisplayName = fullName ?? shortName ?? user.email ?? '러너';

  const { profile, myRoutes, likedRoutes } = await getMypagePageData(user.id, {
    fallbackDisplayName,
  });

  return (
    <Suspense>
      <Mypage profile={profile} myRoutes={myRoutes} likedRoutes={likedRoutes} />
    </Suspense>
  );
}
