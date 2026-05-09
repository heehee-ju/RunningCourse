'use client';

import Image from 'next/image';

import { Icon } from '@/commons/components/icons';

import styles from '../styles.module.css';

type Props = {
  onNext: () => void;
  onPrev: () => void;
};

export function Step2({ onNext, onPrev }: Props) {
  return (
    <>
      <span className={styles.badge}>2/3</span>
      <h2 className={styles.title}>
        코스를 선택하고
        <br />
        <span className={styles.titleGreen}>상세정보</span>를 확인해 보세요
      </h2>
      <p className={styles.subtitle}>
        코스 위치, 거리, 사진 등을 확인하고
        <br />
        마음에 드는 코스를 저장해보세요!
      </p>

      <div className={styles.step2ImageBg}>
        <Image src="/images/onboarding2.png" alt="" fill className={styles.step2FillImage} />
      </div>

      <div className={styles.hintBox}>
        <Icon name="heartFilled" size={18} className={styles.hintIcon} />
        <p className={styles.hintText}>
          내가 작성한 코스와 좋아요 누른 코스를
          <br />
          관리해봐요!
        </p>
      </div>

      <div className={styles.buttonRow}>
        <button type="button" className={styles.buttonPrev} onClick={onPrev}>
          이전
        </button>
        <button type="button" className={styles.buttonNext} onClick={onNext}>
          다음
          <Icon name="chevronRight" size={16} />
        </button>
      </div>
    </>
  );
}
