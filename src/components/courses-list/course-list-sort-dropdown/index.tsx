// 코스 목록 정렬용 커스텀 드롭다운 — 네이티브 select는 모바일에서 옵션 패널이 위로 열릴 수 있어 하향 배치를 보장한다.
'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Icon } from '@/commons/components/icons';

import styles from '../styles.module.css';

import type { CourseListSortMode } from '../utils/sort-course-cards';

const SORT_OPTIONS: { value: CourseListSortMode; label: string }[] = [
  { value: 'distance', label: '가까운 순' },
  { value: 'likes', label: '좋아요 순' },
];

type CourseListSortDropdownProps = {
  sortMode: CourseListSortMode;
  onSelect: (mode: CourseListSortMode) => void;
};

export function CourseListSortDropdown({ sortMode, onSelect }: CourseListSortDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root || root.contains(event.target as Node)) {
        return;
      }
      close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open, close]);

  const currentLabel = SORT_OPTIONS.find((option) => option.value === sortMode)?.label ?? '';

  const handleSelect = (mode: CourseListSortMode) => {
    onSelect(mode);
    close();
    queueMicrotask(() => {
      triggerRef.current?.focus();
    });
  };

  return (
    <div className={styles.sortDropdownRoot} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.sortDropdownTrigger}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label="코스 목록 정렬"
        onClick={() => {
          setOpen((previous) => !previous);
        }}
      >
        <span className={styles.sortDropdownTriggerLabel}>{currentLabel}</span>
        <span
          className={`${styles.sortDropdownChevron} ${open ? styles.sortDropdownChevronOpen : ''}`}
        >
          ▾
        </span>
      </button>
      {open ? (
        <ul id={listboxId} className={styles.sortDropdownList} role="listbox">
          {SORT_OPTIONS.map((option) => (
            <li key={option.value} className={styles.sortDropdownOptionWrap} role="presentation">
              <button
                type="button"
                className={styles.sortDropdownOption}
                role="option"
                aria-selected={sortMode === option.value}
                onClick={() => {
                  handleSelect(option.value);
                }}
              >
                <span className={styles.sortDropdownOptionLabel}>{option.label}</span>
                {sortMode === option.value ? (
                  <span className={styles.sortDropdownCheck} aria-hidden>
                    <Icon name="check" size={14} strokeWidth={2} />
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
