/**
 * 공지 읽음 상태 — 새 공지를 올릴 때 NOTICE_CONTENT_VERSION만 올리면 미읽음 배지가 다시 표시됨
 */

export const NOTICE_CONTENT_VERSION = 1;

const STORAGE_KEY = 'running_course_notice_seen_version';

export const NOTICE_SEEN_UPDATED_EVENT = 'running_course_notice_seen_updated';

function parseSeenVersion(raw: string | null): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) ? n : 0;
}

export function hasUnreadNotice(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return parseSeenVersion(window.localStorage.getItem(STORAGE_KEY)) < NOTICE_CONTENT_VERSION;
}

export function markNoticeContentSeen(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, String(NOTICE_CONTENT_VERSION));
  window.dispatchEvent(new CustomEvent(NOTICE_SEEN_UPDATED_EVENT));
}
