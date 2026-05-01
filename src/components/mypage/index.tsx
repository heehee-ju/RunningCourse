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
 * - [x] flexbox만 사용 (position: absolute 금지)
 * - [x] Button, Card 공통 컴포넌트 사용
 * - [x] Icon 컴포넌트 사용
 */

'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/commons/components/button';
import { Icon } from '@/commons/components/icons';
import { Modal } from '@/commons/components/modal';
import { Header } from '@/commons/layout/header';
import { useAuth } from '@/commons/providers/auth/auth.provider';
import modalBackdropStyles from '@/commons/providers/modal/modal.provider.module.css';
import type { MypageProfileProps, MypageRouteCardData } from '@/commons/types/mypage';

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
} as const;

export type MypageProps = {
  profile: MypageProfileProps;
  myRoutes: MypageRouteCardData[];
  likedRoutes: MypageRouteCardData[];
};

export default function Mypage({ profile, myRoutes, likedRoutes }: MypageProps) {
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
        <Button variant="outline" borderRadius="r12" size="small" color="dark" onClick={open}>
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
        className={styles.cardList}
        role="tabpanel"
        aria-label={activeTab === 'my-course' ? TEXTS.TAB_MY_COURSE : TEXTS.TAB_LIKED_COURSE}
      >
        {courses.length === 0 ? (
          <p className={styles.emptyState}>{emptyMessage}</p>
        ) : (
          courses.map((route) => <RouteCard key={route.id} tab={activeTab} route={route} />)
        )}
      </section>

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
