/**
 * Header — title-only top bar
 * 버전: 1.3.0 · 수정: 2026-04-14
 * 체크리스트:
 * - [x] CSS Module 클래스만 사용
 * - [x] 텍스트 상수 분리
 * - [x] GNB 요소 제거(헤더 역할만 유지)
 * - [x] 좌/우 아이콘 노출 불린 제어
 * - [x] 인라인 스타일 미사용
 * - [x] 시맨틱 header + heading 구조
 */

import { Icon, LogoIcon } from '@/commons/components/icons';
import type { IconName } from '@/commons/components/icons';

import styles from './styles.module.css';

const COPY = {
  runningCourse: '러닝 코스',
  leftIconAriaLabel: '이전',
  rightIconAriaLabel: '옵션',
} as const;

export type HeaderProps = {
  className?: string;
  title?: string;
  showLogo?: boolean;
  showLeftIcon?: boolean;
  showRightIcon?: boolean;
  leftIconName?: IconName;
  rightIconName?: IconName;
  rightIconAriaLabel?: string;
  onLeftIconClick?: () => void;
  onRightIconClick?: () => void;
};

export function Header({
  className,
  title = COPY.runningCourse,
  showLogo = false,
  showLeftIcon = true,
  showRightIcon = true,
  leftIconName = 'chevronLeft',
  rightIconName = 'chevronRight',
  rightIconAriaLabel,
  onLeftIconClick,
  onRightIconClick,
}: HeaderProps) {
  const rootClass = [styles.root, className].filter(Boolean).join(' ').trim();

  return (
    <header className={rootClass}>
      <div className={styles.inner}>
        {showLogo ? (
          <LogoIcon width={44} height={32} className={styles.logo} />
        ) : showLeftIcon ? (
          <button
            type="button"
            className={styles.iconButton}
            aria-label={COPY.leftIconAriaLabel}
            onClick={onLeftIconClick}
          >
            <Icon name={leftIconName} size={24} strokeWidth={2} />
          </button>
        ) : null}
        <h1 className={styles.title}>{title}</h1>
        {showRightIcon ? (
          <button
            type="button"
            className={styles.iconButton}
            aria-label={rightIconAriaLabel ?? COPY.rightIconAriaLabel}
            onClick={onRightIconClick}
          >
            <Icon name={rightIconName} size={24} strokeWidth={2} />
          </button>
        ) : (
          <span className={styles.iconPlaceholder} aria-hidden />
        )}
      </div>
    </header>
  );
}

export default Header;
