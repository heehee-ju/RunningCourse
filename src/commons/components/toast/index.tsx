/**
 * Toast Component
 * version: 1.0.0 | created: 2026-04-11
 * Figma node: 148-3427
 *
 * Rules 자체 점검 체크리스트:
 * - [x] tailwind.config.js 수정 안 함
 * - [x] 색상값 직접 입력 0건 (CSS 변수만 사용, shadow 예외 주석 처리)
 * - [x] 인라인 스타일 0건
 * - [x] index.tsx → 구조만 / styles.module.css → 스타일만 분리
 * - [x] CSS Module 사용 (import styles from './styles.module.css')
 * - [x] CSS 변수 사용 (var(--color-*), var(--typography-*))
 * - [x] 피그마 구조 대비 누락 섹션 없음
 * - [x] 접근성: role="status", aria-live="polite"
 * - [x] 소수점 값 반올림 확인
 */

import Icon from '@/commons/components/icons';

import styles from './styles.module.css';

const TOAST_TEXT = {
  success: '완료되었습니다!',
  failed: '오류가 발생했습니다. 다시 시도해 주세요.',
} as const;

interface ToastProps {
  state: 'success' | 'failed';
  message?: string;
}

export const Toast = ({ state, message }: ToastProps) => {
  return (
    <div className={`${styles.toast} ${styles[state]}`} role="status" aria-live="polite">
      <div className={styles.inner}>
        <span className={styles.iconWrapper}>
          <Icon
            name={state === 'success' ? 'circleCheckBig' : 'circleAlert'}
            size={16}
          />
        </span>
        <span className={styles.text}>{message ?? TOAST_TEXT[state]}</span>
      </div>
    </div>
  );
};

export default Toast;
