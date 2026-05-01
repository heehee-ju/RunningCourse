'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import { useModal } from '@/commons/providers/modal/modal.provider';
import type { TmapCoordinate, TmapLatLngLike, TmapMapLike } from '@/commons/types/tmap';
import { getPedestrianRoute } from '@/repositories/map.repository';

import { MAX_POINT_LENGTH, toCoordinate } from './courseMap.utils';
import { useTmapMapInitialization } from './useTmapMapInitialization';
import { useTmapOverlays } from './useTmapOverlays';

export type SaveRoutePayload = {
  totalDistanceKm: number;
  pathData: {
    points: TmapCoordinate[];
    path: TmapCoordinate[];
  };
  startPoint: TmapCoordinate;
};

type UseCourseMapParams = {
  onSaveRoute?: (payload: SaveRoutePayload) => void;
};

export function useCourseMap({ onSaveRoute }: UseCourseMapParams = {}) {
  const [points, setPoints] = useState<TmapCoordinate[]>([]);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { openModal } = useModal();

  const mapRef = useRef<TmapMapLike | null>(null);

  const setMapInstance = useCallback((map: TmapMapLike) => {
    mapRef.current = map;
  }, []);

  const { clearMarkers, clearPolyline, drawPointMarkers, drawRoutePolyline } =
    useTmapOverlays(mapRef);

  const { initializeMap } = useTmapMapInitialization({
    drawPointMarkers,
    setErrorMessage,
    setMapInstance,
    setPoints,
  });

  const addPoint = useCallback(
    (latLng: TmapLatLngLike) => {
      setErrorMessage(null);
      const coordinate = toCoordinate(latLng);
      if (!coordinate) return;

      setPoints((prev) => {
        if (prev.length >= MAX_POINT_LENGTH) return prev;
        const nextPoints = [...prev, coordinate];
        drawPointMarkers(nextPoints);
        return nextPoints;
      });
    },
    [drawPointMarkers],
  );

  const undo = useCallback(() => {
    setErrorMessage(null);
    setPoints((prev) => {
      if (prev.length === 0) return prev;
      const nextPoints = prev.slice(0, -1);
      drawPointMarkers(nextPoints);
      return nextPoints;
    });
    setDistanceKm(null);
    clearPolyline();
  }, [clearPolyline, drawPointMarkers]);

  const reset = useCallback(() => {
    setPoints([]);
    setDistanceKm(null);
    setErrorMessage(null);
    clearMarkers();
    clearPolyline();
  }, [clearMarkers, clearPolyline]);

  const runSaveRoute = useCallback(async () => {
    if (points.length < 2) {
      setErrorMessage('출발지와 도착지를 포함해 최소 2개의 지점을 선택해 주세요.');
      return;
    }

    const map = mapRef.current;
    if (!map) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const pedestrianRoute = await getPedestrianRoute(points);
      const detailedPath = pedestrianRoute.path
        .map((coordinate) => ({
          lat: Number(coordinate.lat),
          lng: Number(coordinate.lng),
        }))
        .filter((coordinate) => Number.isFinite(coordinate.lat) && Number.isFinite(coordinate.lng));

      if (detailedPath.length < 2) {
        throw new Error('보행자 경로 상세 좌표를 가져오지 못했습니다.');
      }

      drawRoutePolyline(detailedPath);

      const totalDistanceKm = Number((pedestrianRoute.totalDistanceMeters / 1000).toFixed(2));
      setDistanceKm(totalDistanceKm);

      onSaveRoute?.({
        totalDistanceKm,
        pathData: {
          points,
          path: detailedPath,
        },
        startPoint: points[0],
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '경로 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  }, [drawRoutePolyline, onSaveRoute, points]);

  const saveRoute = useCallback(() => {
    openModal({
      type: 'confirm',
      title: '저장하시겠습니까?',
      confirmText: '저장',
      onConfirm: () => {
        void runSaveRoute();
      },
    });
  }, [openModal, runSaveRoute]);

  const isPointLimitReached = points.length >= MAX_POINT_LENGTH;
  const waypointCount = useMemo(() => Math.max(0, points.length - 2), [points.length]);

  return {
    points,
    distanceKm,
    isSaving,
    errorMessage,
    isPointLimitReached,
    waypointCount,
    setMapInstance,
    initializeMap,
    addPoint,
    undo,
    reset,
    saveRoute,
  };
}
