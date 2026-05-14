export function buildCarouselNavButtonClassNames(courseId: string): { prev: string; next: string } {
  const safeToken = courseId.replace(/[^a-zA-Z0-9_-]/g, '-');
  return {
    prev: `course-detail-prev-${safeToken}`,
    next: `course-detail-next-${safeToken}`,
  };
}
