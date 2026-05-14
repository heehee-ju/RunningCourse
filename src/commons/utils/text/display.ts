export function getCourseDescriptionDisplay(
  description: string | null | undefined,
  emptyFallback: string,
): string {
  return description?.trim() || emptyFallback;
}
