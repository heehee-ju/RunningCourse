'use client';

import Image from 'next/image';
import { Fragment } from 'react';

import { Icon } from '@/commons/components/icons';

import styles from '../styles.module.css';

type Props = {
  onPrev: () => void;
  onClose: () => void;
};

const GUIDE_STEPS = [
  {
    num: 1,
    icon: 'pencil' as const,
    title: '경로 그리기',
    descLines: ['지도에 좌표를', '찍어주세요.'],
  },
  {
    num: 2,
    icon: 'save' as const,
    title: '코스 저장',
    descLines: ['코스를 저장하면', '총 거리가 자동으로', '계산돼요.'],
  },
  {
    num: 3,
    icon: 'mapPin' as const,
    title: '코스명 입력 후 등록',
    descLines: ['설명 및 이미지를', '추가 작성도 가능해요!'],
  },
] as const;

export function Step3({ onPrev, onClose }: Props) {
  return (
    <>
      <span className={styles.badge}>3/3</span>
      <h2 className={styles.title}>
        나만의 코스를
        <br />
        <span className={styles.titleGreen}>쉽게 등록</span>할 수 있어요
      </h2>
      <p className={styles.subtitle}>좌표로 찍으면 원하는 경로가 자동으로 만들어져요!</p>

      <div className={styles.guideSection}>
        <div className={styles.guideGroup}>
          <div className={styles.guideSteps}>
            {GUIDE_STEPS.map((item, idx) => (
              <div key={item.num} className={styles.guideItem}>
                <div className={styles.guideItemLeft}>
                  <div className={styles.guideIconWrap}>
                    <div className={styles.guideIconBg}>
                      <Icon name={item.icon} size={13} />
                    </div>
                    <span className={styles.guideStepNum}>{item.num}</span>
                  </div>
                  {idx < GUIDE_STEPS.length - 1 && <div className={styles.guideConnector} />}
                </div>
                <div className={styles.guideItemContent}>
                  <p className={styles.guideStepTitle}>{item.title}</p>
                  <p className={styles.guideStepDesc}>
                    {item.descLines.map((line, lineIndex) => (
                      <Fragment key={`${item.num}-${line}`}>
                        {lineIndex > 0 && <br />}
                        {line}
                      </Fragment>
                    ))}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.guideImageWrap}>
            <Image
              src="/assets/images/onboarding/onboarding3.png"
              alt=""
              width={173}
              height={392}
              className={styles.guideImage}
            />
          </div>
        </div>
      </div>

      <div className={styles.hintBox}>
        <span className={styles.tipLabel}>TIP</span>
        <p className={styles.hintText}>
          지도에 등록되지 않은 길은
          <br />
          예상한 경로와 다르게 연결될 수 있어요!
        </p>
      </div>

      <div className={styles.buttonRow}>
        <button type="button" className={styles.buttonPrev} onClick={onPrev}>
          이전
        </button>
        <button type="button" className={styles.buttonNext} onClick={onClose}>
          사용하기
        </button>
      </div>
    </>
  );
}
