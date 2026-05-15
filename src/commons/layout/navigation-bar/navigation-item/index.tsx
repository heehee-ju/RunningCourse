/**
 * NavigationItem — Figma node 148:3911 (Gnb Item)
 * 체크리스트: CSS Module + 토큰 색상(예외값 주석) / 인라인 스타일 없음 / 4상태(default·hover·active·selected)
 */

import { Icon, type IconName } from '@/commons/components/icons';

import styles from './styles.module.css';

import type { ComponentPropsWithoutRef } from 'react';

type SharedProps = {
  icon: IconName;
  label: string;
  selected?: boolean;
  className?: string;
};

export type NavigationItemProps =
  | (SharedProps & { href: string } & Omit<
        ComponentPropsWithoutRef<'a'>,
        keyof SharedProps | 'children'
      >)
  | (SharedProps & { href?: undefined } & Omit<
        ComponentPropsWithoutRef<'button'>,
        keyof SharedProps | 'children'
      >);

export function NavigationItem(props: NavigationItemProps) {
  const { icon, label, selected = false, className, ...rest } = props;
  const mergedClassName = [styles.item, className].filter(Boolean).join(' ');

  const content = (
    <span className={styles.inner}>
      <span className={styles.iconWrap} aria-hidden>
        <Icon name={icon} size={24} className={styles.icon} />
      </span>
      <span className={styles.label}>{label}</span>
    </span>
  );

  if ('href' in rest && rest.href !== undefined) {
    const { href, ...anchorRest } = rest as { href: string } & Omit<
      ComponentPropsWithoutRef<'a'>,
      keyof SharedProps | 'children'
    >;
    return (
      <a
        href={href}
        className={mergedClassName}
        aria-current={selected ? 'page' : undefined}
        data-selected={selected ? 'true' : undefined}
        {...anchorRest}
      >
        {content}
      </a>
    );
  }

  const buttonRest = rest as Omit<
    ComponentPropsWithoutRef<'button'>,
    keyof SharedProps | 'children'
  >;
  return (
    <button
      type="button"
      className={mergedClassName}
      data-selected={selected ? 'true' : undefined}
      {...buttonRest}
    >
      {content}
    </button>
  );
}

export default NavigationItem;
