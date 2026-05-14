/**
 * 단순 안내 화면 — 공지·제보 등 정적 문구용 레이아웃
 */

'use client';

import { useRouter } from 'next/navigation';

import { Header } from '@/commons/layout/header';

import styles from './styles.module.css';

export type StaticInfoPageProps = {
  title: string;
  description: string;
};

export function StaticInfoPage({ title, description }: StaticInfoPageProps) {
  const router = useRouter();

  return (
    <section className={styles.root}>
      <Header
        title={title}
        showLogo={false}
        showRightIcon={false}
        onLeftIconClick={() => {
          router.back();
        }}
      />
      <div className={styles.body}>
        <p className={styles.text}>{description}</p>
      </div>
    </section>
  );
}
