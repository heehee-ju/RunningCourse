'use client';

import { useEffect, useId, useRef } from 'react';

import { Button } from '@/commons/components/button';
import { Icon } from '@/commons/components/icons';
import { useCurrentLocationMarker } from '@/components/tmap/commons/hooks/useCurrentLocationMarker';
import { getCurrentPositionWithFallback } from '@/components/tmap/commons/utils/geolocation';
import { getTmapv3Runtime } from '@/components/tmap/utils/runtime';

import { useCourseMap, type SaveRoutePayload } from './hooks/useCourseMap';
import styles from './styles.module.css';

import type { TmapMap } from '../home/types';

type CourseSubmitMapProps = {
  onSaveRoute?: (payload: SaveRoutePayload) => void;
};

export default function TmapCourseSubmit({ onSaveRoute }: CourseSubmitMapProps) {
  const mapContainerId = useId().replace(/:/g, '-');
  const mapContainerIdRef = useRef(`tmap-course-submit-${mapContainerId}`);

  const { createCurrentLocationMarker } = useCurrentLocationMarker();
  const {
    points,
    displayDistanceKm,
    isRoundTrip,
    setIsRoundTrip,
    isSaving,
    errorMessage,
    isPointLimitReached,
    mapRef,
    initializeMap,
    undo,
    saveRoute,
  } = useCourseMap({ onSaveRoute });

  useEffect(() => {
    let cancelled = false;

    const initialize = () => {
      if (cancelled) return;
      const mapElementId = mapContainerIdRef.current;
      if (!getTmapv3Runtime() || !document.getElementById(mapElementId)) {
        window.setTimeout(initialize, 120);
        return;
      }

      getCurrentPositionWithFallback((lat, lng) => {
        if (cancelled) return;
        initializeMap(mapElementId, { lat, lng });
        const map = mapRef.current;
        if (map) {
          createCurrentLocationMarker(map as TmapMap, lat, lng);
        }
      });
    };

    initialize();
    return () => {
      cancelled = true;
    };
  }, [createCurrentLocationMarker, initializeMap, mapRef]);

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
      </div>

      <div className={styles.bottomPanel}>
        <label className={styles.roundTripLabel}>
          <input
            type="checkbox"
            checked={isRoundTrip}
            onChange={(e) => setIsRoundTrip(e.target.checked)}
            className={styles.roundTripCheckbox}
          />
          왕복
        </label>

        <div className={styles.metaPanel}>
          <p className={styles.metaText}>
            경로 지점 {points.length}개 | 총 거리{' '}
            {displayDistanceKm !== null ? `${displayDistanceKm.toFixed(2)}km` : '-'}
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
