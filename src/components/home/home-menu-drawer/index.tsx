/**
 * 홈 상단 메뉴 — 햄버거(메뉴) 아이콘으로 열리는 우측 드로어
 */

'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { Icon } from '@/commons/components/icons';
import { ROUTES } from '@/commons/constants/url';
import { useNoticeUnread } from '@/commons/hooks/useNoticeUnread';

import styles from './styles.module.css';

const COPY = {
  dialogLabel: '추가 메뉴',
  closeMenu: '메뉴 닫기',
  closePanel: '닫기',
  notices: '공지사항',
  report: '제보하기',
} as const;

export type HomeMenuDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export function HomeMenuDrawer({ open, onClose }: HomeMenuDrawerProps) {
  const hasNoticeUnread = useNoticeUnread();

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const rootClass = [styles.root, open ? styles.rootOpen : ''].filter(Boolean).join(' ').trim();

  return (
    <div className={rootClass} aria-hidden={!open}>
      <button
        type="button"
        className={styles.dismissOutside}
        aria-label={COPY.closeMenu}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <div className={styles.column}>
        <button
          type="button"
          className={styles.backdrop}
          aria-label={COPY.closeMenu}
          tabIndex={open ? 0 : -1}
          onClick={onClose}
        />
        <aside
          className={styles.panel}
          role="dialog"
          aria-modal="true"
          aria-label={COPY.dialogLabel}
          aria-hidden={!open}
        >
          <div className={styles.panelHeader}>
            <button
              type="button"
              className={styles.closeButton}
              aria-label={COPY.closePanel}
              tabIndex={open ? 0 : -1}
              onClick={onClose}
            >
              <Icon name="x" size={24} strokeWidth={2} />
            </button>
          </div>
          <nav className={styles.nav} aria-label={COPY.dialogLabel}>
            <Link
              href={ROUTES.NOTICE}
              className={styles.navLink}
              tabIndex={open ? 0 : -1}
              aria-label={hasNoticeUnread ? `${COPY.notices}, 새 공지` : COPY.notices}
              onClick={onClose}
            >
              <span className={styles.navLinkLabel}>{COPY.notices}</span>
              {hasNoticeUnread ? (
                <span className={styles.noticeNewBadge} aria-hidden="true">
                  N
                </span>
              ) : null}
            </Link>
            <Link
              href={ROUTES.REPORT}
              className={styles.navLink}
              tabIndex={open ? 0 : -1}
              onClick={onClose}
            >
              {COPY.report}
            </Link>
          </nav>
        </aside>
      </div>
    </div>
  );
}
