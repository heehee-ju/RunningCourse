'use client';

import { useEffect, useId, useRef } from 'react';

import { Button } from '@/commons/components/button';
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
    isRoundTrip,
    setIsRoundTrip,
    isSaving,
    errorMessage,
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

  return (
    <section className={styles.root}>
      <div id={mapContainerIdRef.current} className={styles.map} />

      <div className={styles.topRight}>
        <div className={styles.topInfoPanel}>
          <p className={styles.distanceText}>
            총 거리: {displayDistanceKm !== null ? `${displayDistanceKm.toFixed(2)}km` : '-'}
          </p>
          <p className={isPointLimitReached ? styles.waypointTextFull : styles.waypointText}>
            경로 지점 {points.length}/7
          </p>
          {errorMessage && <p className={styles.errorText}>{errorMessage}</p>}
        </div>

        <label className={styles.roundTripLabel}>
          <input
            type="checkbox"
            checked={isRoundTrip}
            onChange={(e) => setIsRoundTrip(e.target.checked)}
            className={styles.roundTripCheckbox}
          />
          왕복코스
        </label>
      </div>

      <div className={styles.bottomPanel}>
        <Button
          variant="fill"
          borderRadius="r12"
          size="small"
          color="dark"
          iconOnly
          leftIcon={<Icon name="undo-2" size={16} />}
          onClick={undo}
          disabled={points.length === 0}
        />

        <Button
          variant="fill"
          borderRadius="r12"
          size="small"
          color="dark"
          iconOnly
          leftIcon={<Icon name="rotateCcw" size={16} />}
          onClick={reset}
          disabled={points.length === 0}
        />

        <Button
          variant="fill"
          borderRadius="r12"
          size="small"
          color="dark"
          iconOnly
          leftIcon={<Icon name="save" size={16} />}
          onClick={() => void saveRoute()}
          disabled={isSaving || points.length < 2}
        />
      </div>
    </section>
  );
}
