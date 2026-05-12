// CourseCardView를 공통 Card 래퍼로 넘기는 코스 목록용 카드

import { Card } from '@/commons/components/card';
import type { CourseCardView } from '@/commons/types/runroute';

type CourseCardProps = {
  className?: string;
  course: CourseCardView;
  isLiked: boolean;
  isSelected: boolean;
  readonlyLike?: boolean;
  onLikeClick?: () => void;
  onPrimaryActionClick?: () => void;
};

export function CourseCard({
  className,
  course,
  isLiked,
  isSelected,
  readonlyLike,
  onLikeClick,
  onPrimaryActionClick,
}: CourseCardProps) {
  return (
    <Card
      className={className}
      type="default"
      title={course.title}
      location={course.location}
      distanceText={course.distanceText}
      likeCount={course.likeCount}
      isLiked={isLiked}
      isSelected={isSelected}
      thumbnailUrl={course.thumbnailUrl}
      readonlyLike={readonlyLike}
      onLikeClick={onLikeClick}
      onPrimaryActionClick={onPrimaryActionClick}
    />
  );
}
