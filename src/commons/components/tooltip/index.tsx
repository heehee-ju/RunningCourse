import styles from './styles.module.css';

import type { ReactNode } from 'react';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function Tooltip({ content, children, className }: TooltipProps) {
  const rootClassName = [styles.root, className ?? ''].filter(Boolean).join(' ');

  return (
    <span className={rootClassName}>
      <span className={styles.trigger}>{children}</span>
      <span className={styles.content} role="tooltip">
        {content}
      </span>
    </span>
  );
}
