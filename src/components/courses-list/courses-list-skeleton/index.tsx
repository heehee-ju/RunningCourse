// 초기 코스 데이터 로딩 시 카드 목록 영역에 표시하는 스켈레톤 UI

import styles from '../styles.module.css';
import { SKELETON_CARD_COUNT } from '../utils/bottom-sheet';

export function CoursesListSkeleton() {
  return (
    <div className={styles.listLoadingBlock} aria-busy>
      {Array.from({ length: SKELETON_CARD_COUNT }).map((_, index) => (
        <div key={`skeleton-${index}`} className={styles.loadingCardSkeleton}>
          <div className={styles.loadingThumbnailSkeleton} />
          <div className={styles.loadingContentSkeleton}>
            <div className={styles.loadingLineLg} />
            <div className={styles.loadingLineMd} />
            <div className={styles.loadingLineSm} />
          </div>
        </div>
      ))}
    </div>
  );
}
