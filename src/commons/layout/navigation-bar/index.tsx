'use client';

/**
 * NavigationBar — Figma node 148:3498 (Gnb)
 * 버전: 1.0.0 · 생성: 2026-04-05
 * 체크리스트: NavigationItem 조립 / CSS Module·토큰 / 인라인 스타일 없음 / 라벨 상수(COPY) 분리
 * 시맨틱: 하단 GNB는 <nav aria-label> + 목록 구조(03-ui의 header/main/footer는 페이지 엔트리용)
 * 피그마 MCP: 375폭·125×3 탭 — 세부 치수·보더는 NavigationItem(148:3911)에 위임
 */

import type { IconName } from '@/commons/components/icons';
import { useRequireAuthModal } from '@/commons/hooks/useRequireAuthModal';

import { NavigationItem } from './navigation-item';
import styles from './styles.module.css';

const COPY = {
  home: '홈',
  courseRegister: '코스 등록',
  myPage: '마이페이지',
} as const;

export type NavigationBarLink = {
  href: string;
  label: string;
  icon: IconName;
};

export type NavigationBarProps = {
  className?: string;
  /** 현재 경로와 일치하는 항목에 `selected` 적용. 미지정 시 첫 번째 항목이 선택됨(Figma 기본). */
  activeHref?: string;
  /** 미지정 시 홈·코스 등록·마이페이지 기본 3탭 */
  items?: NavigationBarLink[];
};

const DEFAULT_ITEMS: NavigationBarLink[] = [
  { href: '/', label: COPY.home, icon: 'house' },
  { href: '/courses/new', label: COPY.courseRegister, icon: 'squarePlus' },
  { href: '/mypage', label: COPY.myPage, icon: 'userRound' },
];

export function NavigationBar({
  className,
  activeHref,
  items = DEFAULT_ITEMS,
}: NavigationBarProps) {
  const { requireAuth, isPrivateRoute } = useRequireAuthModal();
  const rootClass = [styles.root, className].filter(Boolean).join(' ');

  return (
    <nav className={rootClass} aria-label="주요 메뉴">
      <ul className={styles.list}>
        {items.map((item, index) => {
          const selected = activeHref !== undefined ? activeHref === item.href : index === 0;
          return (
            <li key={`${item.href}-${item.label}`} className={styles.itemWrap}>
              <NavigationItem
                href={item.href}
                icon={item.icon}
                label={item.label}
                selected={selected}
                onClick={(event) => {
                  if (!isPrivateRoute(item.href)) {
                    return;
                  }

                  const canNavigate = requireAuth({ redirectTo: item.href });
                  if (!canNavigate) {
                    event.preventDefault();
                  }
                }}
              />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default NavigationBar;
