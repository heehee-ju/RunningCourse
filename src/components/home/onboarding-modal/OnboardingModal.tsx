'use client';

import { Icon } from '@/commons/components/icons';

import { useOnboarding } from './hooks/useOnboarding';
import { Step1 } from './steps/Step1';
import { Step2 } from './steps/Step2';
import { Step3 } from './steps/Step3';
import styles from './styles.module.css';

type Props = {
  onClose: () => void;
};

export function OnboardingModal({ onClose }: Props) {
  const { step, totalSteps, goNext, goPrev } = useOnboarding();

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="온보딩">
      <div className={styles.modal}>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="닫기">
          <Icon name="x" size={20} />
        </button>

        <div className={styles.stepContent}>
          {step === 1 && <Step1 onNext={goNext} />}
          {step === 2 && <Step2 onNext={goNext} onPrev={goPrev} />}
          {step === 3 && <Step3 onPrev={goPrev} onClose={onClose} />}
        </div>

        <div className={styles.dots} aria-label="진행 단계">
          {Array.from({ length: totalSteps }, (_, i) => (
            <span key={i} className={`${styles.dot} ${i + 1 === step ? styles.dotActive : ''}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
