export type DistanceCategory = 'UNDER_3' | 'BETWEEN_3_AND_5' | 'BETWEEN_5_AND_10' | 'OVER_10';

// ~3km → UNDER_3 · 3~5km → BETWEEN_3_AND_5 · 5~10km → BETWEEN_5_AND_10 · 10km~ → OVER_10
export function getDistanceCategory(distanceMeters: number): DistanceCategory {
  const distanceKm = distanceMeters / 1000;
  if (distanceKm <= 3) return 'UNDER_3';
  if (distanceKm <= 5) return 'BETWEEN_3_AND_5';
  if (distanceKm <= 10) return 'BETWEEN_5_AND_10';
  return 'OVER_10';
}
