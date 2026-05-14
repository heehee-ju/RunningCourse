/**
 * 공지 미읽음 여부 — 공지 페이지 방문 시 markNoticeContentSeen과 연동
 */

import { useEffect, useState } from 'react';

import { NOTICE_SEEN_UPDATED_EVENT, hasUnreadNotice } from '@/commons/utils/notice-read-state';

export function useNoticeUnread(): boolean {
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    const sync = () => {
      setUnread(hasUnreadNotice());
    };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(NOTICE_SEEN_UPDATED_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(NOTICE_SEEN_UPDATED_EVENT, sync);
    };
  }, []);

  return unread;
}
