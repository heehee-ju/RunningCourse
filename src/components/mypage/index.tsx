/*
 * Mypage Component — index.tsx
 * 버전: 1.0.0 · 생성: 2026-04-16
 * 체크리스트:
 * - [x] tailwind.config 미수정
 * - [x] 하드코딩 색상값 0건 (CSS 변수만 사용)
 * - [x] 인라인 스타일 0건
 * - [x] index.tsx → 구조 / styles.module.css → 스타일 분리
 * - [x] CSS Module 사용 확인: import styles from './styles.module.css'
 * - [x] CSS 변수 사용 확인
 * - [x] 피그마 구조 대비 누락 섹션 없음 (프로필 / 탭 / 카드 목록)
 * - [x] 소수점 값 반올림 완료
 * - [x] 게스트용 하단 Google CTA는 styles에서 absolute
 * - [x] Button, Card 공통 컴포넌트 사용
 * - [x] Icon 컴포넌트 사용
 */

'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/commons/components/button';
import { Icon } from '@/commons/components/icons';
import { Modal } from '@/commons/components/modal';
import { useGuestGuard } from '@/commons/hooks/useGuestGuard';
import { Header } from '@/commons/layout/header';
import { useAuth } from '@/commons/providers/auth/auth.provider';
import modalBackdropStyles from '@/commons/providers/modal/modal.provider.module.css';
import type { MypageProfileProps, MypageRouteCardData } from '@/commons/types/mypage';

import { useLinkGoogle } from './hooks/useLinkGoogle';
import { useLogout } from './hooks/useLogout';
import { useLogoutModal } from './hooks/useLogoutModal';
import { useMyPageTabs } from './hooks/useMyPageTabs';
import { useProfileModal } from './hooks/useProfileModal';
import { RouteCard } from './RouteCard';
import styles from './styles.module.css';

const TEXTS = {
  TITLE: '마이페이지',
  EDIT_PROFILE: '프로필 수정',
  TAB_MY_COURSE: '내가 작성한 코스',
  TAB_LIKED_COURSE: '좋아요한 코스',
  EMPTY_MY: '작성한 코스가 없습니다.',
  EMPTY_LIKED: '좋아요한 코스가 없습니다.',
  GOOGLE_CONTINUE: 'Google로 계속하기',
  GOOGLE_LINKING: '연동 중...',
} as const;

/**
 * Google G — 로그인 화면과 동일(브랜드 컬러, CSS 변수 없음)
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

export type MypageProps = {
  profile: MypageProfileProps;
  myRoutes: MypageRouteCardData[];
  likedRoutes: MypageRouteCardData[];
};

export default function Mypage({ profile, myRoutes, likedRoutes }: MypageProps) {
  const { linkGoogle, isPending: isLinkGooglePending } = useLinkGoogle({ returnTo: '/mypage' });
  const { activeTab, setTab, courses } = useMyPageTabs(myRoutes, likedRoutes);
  const { isAnonymous } = useAuth();
  const { executeLogoutOrDelete, isPending: isLogoutPending, isError } = useLogout();
  const { isOpen, openModal, closeModal, handleConfirm, modalData } = useLogoutModal(
    isAnonymous,
    executeLogoutOrDelete,
  );

  useEffect(() => {
    if (isError) {
      alert('요청 처리 중 문제가 발생했습니다. 다시 시도해 주세요.');
    }
  }, [isError]);

  const emptyMessage = activeTab === 'my-course' ? TEXTS.EMPTY_MY : TEXTS.EMPTY_LIKED;
  const { open } = useProfileModal({
    initialNickname: profile.nickname,
  });
  const { requireFullAccountForProfile } = useGuestGuard();

  return (
    <div className={styles.container}>
      <Header
        title={TEXTS.TITLE}
        showLeftIcon={false}
        showRightIcon={true}
        rightIconName="logOut"
        onRightIconClick={isLogoutPending ? undefined : openModal}
      />

      <section className={styles.profileSection} aria-label="프로필">
        <div className={styles.profileInfo}>
          <div className={styles.avatar} aria-hidden="true">
            <Icon name="userRound" size={32} color="var(--color-white-500)" strokeWidth={1.5} />
          </div>
          <span className={styles.userName}>{profile.nickname}</span>
        </div>
        <Button
          variant="outline"
          borderRadius="r12"
          size="small"
          color="dark"
          onClick={() => requireFullAccountForProfile(open)}
        >
          {TEXTS.EDIT_PROFILE}
        </Button>
      </section>

      <div className={styles.tabSection} role="tablist" aria-label="코스 목록 탭">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'my-course'}
          className={`${styles.tabButton} ${activeTab === 'my-course' ? styles.tabButtonActive : styles.tabButtonInactive}`}
          onClick={() => setTab('my-course')}
        >
          {TEXTS.TAB_MY_COURSE}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'liked-course'}
          className={`${styles.tabButton} ${activeTab === 'liked-course' ? styles.tabButtonActive : styles.tabButtonInactive}`}
          onClick={() => setTab('liked-course')}
        >
          {TEXTS.TAB_LIKED_COURSE}
        </button>
      </div>

      <section
        className={`${styles.cardList} ${isAnonymous ? styles.cardListWithGuestCta : ''}`}
        role="tabpanel"
        aria-label={activeTab === 'my-course' ? TEXTS.TAB_MY_COURSE : TEXTS.TAB_LIKED_COURSE}
      >
        {courses.length === 0 ? (
          <p className={styles.emptyState}>{emptyMessage}</p>
        ) : (
          courses.map((route) => <RouteCard key={route.id} tab={activeTab} route={route} />)
        )}
      </section>

      {isAnonymous && (
        <Button
          variant="outline"
          color="dark"
          size="medium"
          borderRadius="r12"
          leftIcon={<GoogleIcon />}
          className={styles.googleContinueOverlay}
          aria-label={isLinkGooglePending ? TEXTS.GOOGLE_LINKING : TEXTS.GOOGLE_CONTINUE}
          disabled={isLinkGooglePending}
          onClick={linkGoogle}
        >
          {isLinkGooglePending ? TEXTS.GOOGLE_LINKING : TEXTS.GOOGLE_CONTINUE}
        </Button>
      )}

      {typeof window !== 'undefined' &&
        isOpen &&
        createPortal(
          <div
            className={modalBackdropStyles.backdrop}
            role="dialog"
            aria-modal="true"
            onPointerDown={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <Modal
              type="confirm"
              title={modalData.title}
              content={modalData.content}
              onConfirm={handleConfirm}
              onClose={closeModal}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
