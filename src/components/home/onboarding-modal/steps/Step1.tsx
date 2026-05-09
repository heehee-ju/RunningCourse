'use client';

import Image from 'next/image';

import { Icon } from '@/commons/components/icons';

import styles from '../styles.module.css';

type Props = {
  onNext: () => void;
};

export function Step1({ onNext }: Props) {
  return (
    <>
      <span className={styles.badge}>1/3</span>
      <h2 className={styles.title}>
        <span className={styles.titleGreen}>루트런</span>이 처음이신가요?
      </h2>
      <p className={styles.subtitle}>
        지도 기반 러닝 코스 플랫폼,
        <br />
        루트런의 주요 기능을 소개해드릴게요!
      </p>

      <div className={styles.step1ImageWrap}>
        <Image
          src="/images/onboarding1.png"
          alt=""
          width={467}
          height={321}
          className={styles.step1Image}
        />
      </div>

      <div className={styles.hintBox}>
        <Icon name="mapPin" size={18} className={styles.hintIcon} />
        <p className={styles.hintText}>
          현재 위치를 기준으로
          <br />
          주변의 다양한 러닝 코스를 찾아보세요
        </p>
      </div>

      <div className={styles.buttonRow}>
        <button type="button" className={styles.buttonNext} onClick={onNext}>
          다음
          <Icon name="chevronRight" size={16} />
        </button>
      </div>
    </>
  );
}
