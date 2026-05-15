'use client';

import { useCallback, useEffect, useId, useRef } from 'react';

import { Icon } from '@/commons/components/icons';
import { getCurrentPositionWithFallback } from '@/commons/utils/geo/geolocation';
import { getTmapv3Runtime } from '@/commons/utils/tmap/runtime';
import type { TmapMap } from '@/commons/utils/tmap/types';
import { useCurrentLocationMarker } from '@/components/tmap/commons/hooks/useCurrentLocationMarker';

import { useCourseMap, type SaveRoutePayload } from './hooks/useCourseMap';
import styles from './styles.module.css';

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
    isSaving,
    isPointLimitReached,
    mapRef,
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

  const handleRefreshLocation = useCallback(() => {
    getCurrentPositionWithFallback((lat, lng) => {
      const map = mapRef.current;
      if (!map) return;
      const Tmapv3 = getTmapv3Runtime();
      if (!Tmapv3) return;
      (map as TmapMap).setCenter(new Tmapv3.LatLng(lat, lng));
    });
  }, [mapRef]);

  const canSave = points.length >= 2;

  return (
    <section className={styles.root}>
      <div id={mapContainerIdRef.current} className={styles.map} />

      {/* 우측 상단: 되돌리기 | 초기화 */}
      <div className={styles.topRightControls}>
        <button
          type="button"
          className={styles.controlButton}
          onClick={undo}
          disabled={points.length === 0}
        >
          <Icon name="undo-2" size={24} />
          <span className={styles.controlButtonLabel}>되돌리기</span>
        </button>

        <button
          type="button"
          className={styles.controlButton}
          onClick={reset}
          disabled={points.length === 0}
        >
          <Icon name="rotateCcw" size={24} />
          <span className={styles.controlButtonLabel}>초기화</span>
        </button>
      </div>

      {/* 하단 바 좌측 위: 현재 위치 */}
      <button type="button" className={styles.locationButton} onClick={handleRefreshLocation}>
        <Icon name="locateFixed" size={24} />
      </button>

      {/* 하단 바 */}
      <div className={styles.bottomBar}>
        {/* 경로 지점 */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Icon name="mapPin" size={15} color="#7d7d7d" />
            <span>경로 지점</span>
          </div>
          <div className={styles.countDisplay}>
            <span className={isPointLimitReached ? styles.countNumberFull : styles.countNumber}>
              {points.length}
            </span>
            <span className={styles.countDivider}>/ 7</span>
          </div>
        </div>

        <div className={styles.divider} />

        {/* 총 거리 */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Icon name="ruler" size={15} color="#7d7d7d" />
            <span>총 거리</span>
          </div>
          <div className={styles.distanceDisplay}>
            <span className={styles.distanceValue}>
              {displayDistanceKm !== null ? displayDistanceKm.toFixed(2) : '-'}
            </span>
            <span className={styles.distanceUnit}>km</span>
          </div>
        </div>

        <div className={styles.divider} />

        {/* 코스 저장 */}
        <div className={styles.saveSection}>
          <button
            type="button"
            className={`${styles.saveButton} ${canSave ? styles.saveButtonActive : ''}`}
            onClick={() => void saveRoute()}
            disabled={isSaving || !canSave}
          >
            <Icon name="save" size={14} />
            <span>코스 저장</span>
          </button>
        </div>
      </div>
    </section>
  );
}
