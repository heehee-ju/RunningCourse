'use client';

import { useCallback, useRef } from 'react';

import { getTmapv3Runtime } from '@/commons/utils/tmap/runtime';
import type { TmapMap, TmapMarker } from '@/commons/utils/tmap/types';
import { applyPointerCursorToTmapMarker } from '@/components/tmap/commons/utils/apply-pointer-cursor-to-tmap-marker';

const INDICATOR_SIZE = 40;

function buildLocationIndicatorIcon(size: number): string {
  const center = size / 2;
  const outerRingRadius = Math.round(size * 0.42);
  const innerWhiteRadius = Math.round(size * 0.23);
  const dotRadius = Math.round(size * 0.17);
  const coreRadius = Math.round(size * 0.13);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${center}" cy="${center}" r="${outerRingRadius}" fill="#2F80FF" opacity="0.16"/>
  <circle cx="${center}" cy="${center}" r="${innerWhiteRadius}" fill="#FFFFFF" opacity="0.98"/>
  <circle cx="${center}" cy="${center}" r="${dotRadius}" fill="#2F80FF"/>
  <circle cx="${center}" cy="${center}" r="${coreRadius}" fill="#2F80FF"/>
</svg>
`.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function useCurrentLocationMarker() {
  const currentLocationMarkerRef = useRef<TmapMarker | null>(null);
  const currentLocationCoordinateRef = useRef<{ lat: number; lng: number } | null>(null);

  const createCurrentLocationMarker = useCallback((map: TmapMap, lat: number, lng: number) => {
    const Tmapv3 = getTmapv3Runtime();
    if (!Tmapv3) return;

    currentLocationCoordinateRef.current = { lat, lng };

    const icon = buildLocationIndicatorIcon(INDICATOR_SIZE);
    const markerOptions: Record<string, unknown> = {
      position: new Tmapv3.LatLng(lat, lng),
      map,
      icon,
      iconSize: new Tmapv3.Size(INDICATOR_SIZE, INDICATOR_SIZE),
    };
    if (Tmapv3.Point) {
      markerOptions.iconAnchor = new Tmapv3.Point(INDICATOR_SIZE / 2, INDICATOR_SIZE / 2);
    }

    // 줌 레벨에 따라 아이콘 크기가 달라지므로 갱신 시 재생성한다.
    currentLocationMarkerRef.current?.setMap(null);
    const locationMarker = new Tmapv3.Marker(markerOptions);
    applyPointerCursorToTmapMarker(locationMarker);
    currentLocationMarkerRef.current = locationMarker;
  }, []);

  return {
    createCurrentLocationMarker,
    currentLocationMarkerRef,
    currentLocationCoordinateRef,
  };
}
