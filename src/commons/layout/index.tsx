/**
 * Layout — 공통 앱 레이아웃
 * 버전: 1.2.0 · 생성: 2026-04-16
 * 체크리스트:
 * - [x] CSS Module 클래스만 사용
 * - [x] 인라인 스타일 미사용
 * - [x] NavigationBar import 조립
 * - [x] children 영역 flex: 1 / 내부 스크롤
 * - [x] max-width 480px / 화면 중앙 정렬
 * - [x] NAVIGATION_BAR_ROUTES 기반 조건부 렌더링
 */

'use client';

import { usePathname } from 'next/navigation';

import { NAVIGATION_BAR_DYNAMIC_PATTERNS, NAVIGATION_BAR_ROUTES } from '@/commons/constants/url';

import { NavigationBar } from './navigation-bar';
import styles from './styles.module.css';

import type { ReactNode } from 'react';

type LayoutProps = {
  children: ReactNode;
  /** 서버 레이아웃에서 조회한 게스트 코스 작성 여부(1건 이상). 비게스트·미로그인은 false로 두면 된다. */
  hasWrittenCourse?: boolean;
};

function navigationActiveHref(pathname: string): string {
  if (pathname === '/home') return '/';
  return pathname;
}

export function Layout({ children, hasWrittenCourse = false }: LayoutProps) {
  const pathname = usePathname();
  const showNavigationBar =
    (NAVIGATION_BAR_ROUTES as readonly string[]).includes(pathname) ||
    NAVIGATION_BAR_DYNAMIC_PATTERNS.some((pattern) => pattern.test(pathname));

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <main className={styles.middle}>{children}</main>
        {showNavigationBar && (
          <div className={styles.bottom}>
            <NavigationBar
              activeHref={navigationActiveHref(pathname)}
              hasWrittenCourse={hasWrittenCourse}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default Layout;
