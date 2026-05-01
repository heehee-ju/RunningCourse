/*
 * Login Component — index.tsx
 * 버전: 1.0.0 · 생성: 2026-04-16
 * 체크리스트:
 * - [x] tailwind.config 미수정
 * - [x] 하드코딩 색상값 0건 (Google G SVG 브랜드 컬러 제외 — CSS 변수 없음)
 * - [x] 인라인 스타일 0건
 * - [x] index.tsx → 구조 / styles.module.css → 스타일 분리
 * - [x] CSS Module 사용 확인: import styles from './styles.module.css'
 * - [x] CSS 변수 사용 확인
 * - [x] 피그마 구조 대비 누락 섹션 없음
 * - [x] 소수점 값 반올림 완료
 */

'use client';

import { Button } from '@/commons/components/button';
import { Spinner } from '@/commons/components/spinner';

import { useAnonymousLogin } from './hooks/index.anonymous.login.hook';
import { useGoogleLogin } from './hooks/index.google.login.hook';
import styles from './styles.module.css';

// i18n 대비 텍스트 상수 분리
const TEXTS = {
  APP_ICON: 'RR',
  APP_NAME: 'RouteRun',
  GOOGLE_LOGIN: 'Google 계정으로 로그인',
  GUEST_LOGIN: '게스트 로그인',
} as const;

export type LoginProps = {
  /** 로그인 성공 후 이동할 경로 (미들웨어 `?next=` 등에서 전달) */
  returnTo?: string;
};

/*
 * Google G 브랜드 아이콘 (lucide-react 미지원 → 인라인 SVG 사용)
 * 브랜드 컬러: #4285F4, #34A853, #FBBC05, #EA4335 (Google 공식 브랜드 컬러 — CSS 변수 없음)
 */
const GoogleIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

export default function Login({ returnTo = '/' }: LoginProps) {
  const { trigger: googleLogin, isPending: isGooglePending } = useGoogleLogin({ returnTo });
  const { trigger: anonymousLogin, isLoading: isGuestPending } = useAnonymousLogin({ returnTo });
  const isBusy = isGooglePending || isGuestPending;

  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        {/* 로고 섹션 */}
        <div className={styles.logoSection} aria-label="RouteRun 로고">
          <div className={styles.logoIcon} aria-hidden="true">
            <span className={styles.logoIconText}>{TEXTS.APP_ICON}</span>
          </div>
          <span className={styles.logoText}>{TEXTS.APP_NAME}</span>
        </div>

        {/* 버튼 섹션 */}
        <div className={styles.buttonsSection}>
          <Button
            variant="fill"
            color="dark"
            size="medium"
            borderRadius="r12"
            leftIcon={<GoogleIcon />}
            className={styles.googleButton}
            disabled={isBusy}
            onClick={googleLogin}
          >
            {TEXTS.GOOGLE_LOGIN}
          </Button>

          <Button
            variant="outline"
            color="dark"
            size="medium"
            borderRadius="r12"
            className={styles.guestButton}
            disabled={isBusy}
            onClick={anonymousLogin}
          >
            {TEXTS.GUEST_LOGIN}
          </Button>
        </div>
      </div>

      {isBusy ? (
        <div className={styles.loadingOverlay} aria-busy="true" aria-live="polite">
          <Spinner size="lg" />
        </div>
      ) : null}
    </div>
  );
}
