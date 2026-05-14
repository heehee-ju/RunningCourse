import { useCallback, useRef } from 'react';

import type { TmapCoordinate, TmapLatLngLike, TmapMapLike, TmapV3 } from '@/commons/types/tmap';
import { bindMapEvents } from '@/commons/utils/tmap/events';
import { getTmapv3Runtime } from '@/commons/utils/tmap/runtime';

import { extractLatLngFromVectorEvent, MAX_POINT_LENGTH, toCoordinate } from './courseMap.utils';

import type { Dispatch, SetStateAction } from 'react';

type UseTmapMapInitializationParams = {
  drawPointMarkers: (nextPoints: TmapCoordinate[]) => void;
  setErrorMessage: Dispatch<SetStateAction<string | null>>;
  setMapInstance: (map: TmapMapLike) => void;
  setPoints: Dispatch<SetStateAction<TmapCoordinate[]>>;
};

export function useTmapMapInitialization({
  drawPointMarkers,
  setErrorMessage,
  setMapInstance,
  setPoints,
}: UseTmapMapInitializationParams) {
  const isMapInitializedRef = useRef(false);
  const isClickListenerBoundRef = useRef(false);
  const lastClickSignatureRef = useRef<string | null>(null);

  const initializeMap = useCallback(
    (mapElementId: string, center: TmapCoordinate) => {
      if (isMapInitializedRef.current) return;
      const Tmapv3 = getTmapv3Runtime() as TmapV3 | undefined;
      const mapElement = document.getElementById(mapElementId);
      if (!Tmapv3 || !mapElement) return;

      const map = new Tmapv3.Map(mapElementId, {
        center: new Tmapv3.LatLng(center.lat, center.lng),
        width: '100%',
        height: '100%',
        zoom: 15,
        scrollwheel: true,
        zoomControl: false,
        minZoom: 8,
      });
      setMapInstance(map);
      isMapInitializedRef.current = true;

      const clickListener = (event?: {
        lngLat?: TmapLatLngLike;
        latLng?: TmapLatLngLike;
        _latLng?: TmapLatLngLike;
      }) => {
        // eslint-disable-next-line no-console -- Tmap v3 click payload shape debugging
        console.log('Map Click Event:', event);
        const rawLatLng = extractLatLngFromVectorEvent(event);
        const nextCoordinate = rawLatLng ? toCoordinate(rawLatLng) : null;
        if (!nextCoordinate) return;

        const clickSignature = `${nextCoordinate.lat.toFixed(7)}:${nextCoordinate.lng.toFixed(7)}`;
        if (lastClickSignatureRef.current === clickSignature) return;
        lastClickSignatureRef.current = clickSignature;
        window.setTimeout(() => {
          if (lastClickSignatureRef.current === clickSignature) {
            lastClickSignatureRef.current = null;
          }
        }, 0);

        setErrorMessage(null);
        setPoints((prev) => {
          if (prev.length >= MAX_POINT_LENGTH) return prev;
          const nextPoints = [...prev, nextCoordinate];
          drawPointMarkers(nextPoints);
          return nextPoints;
        });
      };

      const clickListenerUnknown = clickListener as (event?: unknown) => void;

      const bindClickListener = () => {
        if (isClickListenerBoundRef.current) return;

        const mapLike = map as TmapMapLike & {
          on?: (eventName: string, callback: (event?: unknown) => void) => void;
          addListener?: (eventName: string, callback: (event?: unknown) => void) => void;
        };

        const tmapv3WithEvent = Tmapv3 as TmapV3 & {
          Event?: {
            addListener?: (
              target: object,
              eventName: string,
              callback: (event?: unknown) => void,
            ) => void;
          };
        };

        if (typeof mapLike.on === 'function' || typeof mapLike.addListener === 'function') {
          bindMapEvents(mapLike, ['click', 'Click'], clickListenerUnknown as () => void);
          isClickListenerBoundRef.current = true;
          return;
        }

        if (tmapv3WithEvent.Event?.addListener) {
          tmapv3WithEvent.Event.addListener(map as object, 'click', clickListenerUnknown);
          tmapv3WithEvent.Event.addListener(map as object, 'Click', clickListenerUnknown);
          isClickListenerBoundRef.current = true;
        }
      };

      const mapLikeWithLoad = map as TmapMapLike & {
        on?: (eventName: string, callback: () => void) => void;
        addListener?: (eventName: string, callback: () => void) => void;
      };

      if (
        typeof mapLikeWithLoad.on === 'function' ||
        typeof mapLikeWithLoad.addListener === 'function'
      ) {
        bindMapEvents(mapLikeWithLoad, ['load'], bindClickListener);
      }

      bindClickListener();
    },
    [drawPointMarkers, setErrorMessage, setMapInstance, setPoints],
  );

  return {
    initializeMap,
  };
}
