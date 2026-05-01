import Login from '@/components/login';

function safeReturnPath(target: string | string[] | undefined): string {
  const value = Array.isArray(target) ? target[0] : target;
  if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) {
    return value;
  }
  return '/';
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string | string[]; redirect_to?: string | string[] };
}) {
  // 구버전 next 파라미터와 신규 redirect_to 파라미터를 모두 지원한다.
  const returnTo = searchParams.redirect_to ?? searchParams.next;
  return <Login returnTo={safeReturnPath(returnTo)} />;
}
