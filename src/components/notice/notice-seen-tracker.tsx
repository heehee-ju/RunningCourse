/**
 * 공지 페이지 진입 시 로컬 읽음 버전을 최신으로 맞춤
 */

'use client';

import { useEffect } from 'react';

import { markNoticeContentSeen } from '@/commons/utils/notice-read-state';

export function NoticeSeenTracker() {
  useEffect(() => {
    markNoticeContentSeen();
  }, []);
  return null;
}
