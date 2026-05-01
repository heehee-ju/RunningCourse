'use client';

import { useEffect, useId, useRef } from 'react';

import { Button } from '@/commons/components/button';
import { Icon } from '@/commons/components/icons';

import { useCourseMap, type SaveRoutePayload } from './hooks/useCourseMap';
import styles from './styles.module.css';

type CourseSubmitMapProps = {
  onSaveRoute?: (payload: SaveRoutePayload) => void;
};

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };

export default function TmapCourseSubmit({ onSaveRoute }: CourseSubmitMapProps) {
  const mapContainerId = useId().replace(/:/g, '-');
  const mapContainerIdRef = useRef(`tmap-course-submit-${mapContainerId}`);

  const {
    points,
    distanceKm,
    isSaving,
    errorMessage,
    isPointLimitReached,
    initializeMap,
    undo,
    reset,
    saveRoute,
  } = useCourseMap({ onSaveRoute });

  useEffect(() => {
    let cancelled = false;

    const initialize = () => {
      if (cancelled) return;
      const mapElementId = mapContainerIdRef.current;
      if (!window.Tmapv3 || !document.getElementById(mapElementId)) {
        window.setTimeout(initialize, 120);
        return;
      }
      initializeMap(mapElementId, DEFAULT_CENTER);
    };

    initialize();
    return () => {
      cancelled = true;
    };
  }, [initializeMap]);

  return (
    <section className={styles.root}>
      <div id={mapContainerIdRef.current} className={styles.map} />

      <div className={styles.topControls}>
        <Button
          variant="outline"
          borderRadius="r12"
          size="small"
          color="dark"
          leftIcon={<Icon name="undo-2" size={16} />}
          onClick={undo}
          disabled={points.length === 0}
        >
          되돌리기
        </Button>
        <Button
          variant="outline"
          borderRadius="r12"
          size="small"
          color="dark"
          leftIcon={<Icon name="rotateCcw" size={16} />}
          onClick={reset}
          disabled={points.length === 0}
        >
          초기화
        </Button>
      </div>

      <div className={styles.bottomPanel}>
        <div className={styles.metaPanel}>
          <p className={styles.metaText}>
            선택지점 {points.length}개 | 확정거리{' '}
            {distanceKm !== null ? `${distanceKm.toFixed(2)}km` : '-'}
          </p>
          {isPointLimitReached && (
            <p className={styles.warningText}>최대 7개 지점까지 선택할 수 있습니다.</p>
          )}
          {errorMessage && <p className={styles.errorText}>{errorMessage}</p>}
        </div>

        <Button
          variant="fill"
          borderRadius="r12"
          size="small"
          color="dark"
          leftIcon={<Icon name="save" size={16} />}
          onClick={() => void saveRoute()}
          disabled={isSaving || points.length < 2}
        >
          {isSaving ? '저장 중...' : '코스 저장'}
        </Button>
      </div>
    </section>
  );
}
