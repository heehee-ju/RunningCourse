import { SEOUL_CITY_HALL_COORDINATE } from '@/commons/utils/geo';

export const DEFAULT_GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 6000,
  maximumAge: 15000,
};

export const PRECISE_GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

export function getCurrentPositionWithFallback(
  onSuccess: (lat: number, lng: number) => void,
  options: PositionOptions = DEFAULT_GEOLOCATION_OPTIONS,
): void {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    onSuccess(SEOUL_CITY_HALL_COORDINATE.lat, SEOUL_CITY_HALL_COORDINATE.lng);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      onSuccess(position.coords.latitude, position.coords.longitude);
    },
    () => {
      onSuccess(SEOUL_CITY_HALL_COORDINATE.lat, SEOUL_CITY_HALL_COORDINATE.lng);
    },
    options,
  );
}
