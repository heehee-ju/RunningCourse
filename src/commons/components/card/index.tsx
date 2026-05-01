import { Button } from '@/commons/components/button';
import { Icon } from '@/commons/components/icons';

import styles from './styles.module.css';

export type CardType = 'default' | 'my-course' | 'liked-course';

type CardBaseProps = {
  className?: string;
  type: CardType;
  isLiked: boolean;
  title?: string;
  location?: string;
  distanceText?: string;
  likeCount?: number;
  onLikeClick?: () => void;
  onPrimaryActionClick?: () => void;
  onSecondaryActionClick?: () => void;
  secondaryActionDisabled?: boolean;
};

type DefaultCardProps = CardBaseProps & {
  type: 'default';
  isSelected: boolean;
};

type ActionCardProps = CardBaseProps & {
  type: 'my-course' | 'liked-course';
  isSelected?: never;
};

export type CardProps = DefaultCardProps | ActionCardProps;

export function Card({
  className,
  type,
  isLiked,
  isSelected,
  title = '한강 러닝 코스',
  location = '여의도 한강공원',
  distanceText = '5km',
  likeCount = 234,
  onLikeClick,
  onPrimaryActionClick,
  onSecondaryActionClick,
  secondaryActionDisabled = false,
}: CardProps) {
  const showActions = type === 'my-course' || type === 'liked-course';

  const rootClass = [
    styles.root,
    showActions ? styles.rootWithActions : styles.rootDefault,
    type === 'default' && isSelected ? styles.selected : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const likeLabel = isLiked ? '코스 찜 취소' : '코스 찜하기';
  const likeContent = (
    <>
      <Icon
        name={isLiked ? 'heartFilled' : 'heart'}
        size={1}
        color="var(--color-red-500)"
        className={styles.likeIcon}
      />
      <span className={styles.likeCount}>{likeCount}</span>
    </>
  );

  return (
    <article className={rootClass}>
      <section className={styles.topSection}>
        <div className={styles.thumbnailWrap}>
          <span className={styles.thumbnailPlaceholder}>썸네일</span>
        </div>

        <div className={styles.content}>
          <div className={styles.contentInfo}>
            <div className={styles.contentTop}>
              <h3 className={styles.title}>{title}</h3>
              {onLikeClick ? (
                <button
                  type="button"
                  className={`${styles.likeWrap} ${styles.likeButton}`}
                  aria-label={likeLabel}
                  aria-pressed={isLiked}
                  onClick={(event) => {
                    event.stopPropagation();
                    onLikeClick();
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                  }}
                >
                  {likeContent}
                </button>
              ) : (
                <div className={styles.likeWrap} aria-label={likeLabel}>
                  {likeContent}
                </div>
              )}
            </div>

            <div className={styles.locationWrap}>
              <Icon
                name="mapPin"
                size={1}
                color="var(--color-card_outline-500)"
                className={styles.locationIcon}
              />
              <span className={styles.location}>{location}</span>
            </div>
          </div>

          <p className={styles.distance}>{distanceText}</p>
        </div>
      </section>

      {showActions ? (
        <section className={styles.actions} aria-label="카드 액션">
          <Button
            variant="outline"
            borderRadius="r12"
            size="small"
            color="dark"
            className={styles.actionButton}
            leftIcon={
              type === 'my-course' ? (
                <Icon name="pencil" size={18} color="var(--color-black-300)" strokeWidth={1.75} />
              ) : undefined
            }
            onClick={onPrimaryActionClick}
          >
            {type === 'my-course' ? '수정' : '상세보기'}
          </Button>

          <Button
            variant="outline"
            borderRadius="r12"
            size="small"
            color="red"
            className={styles.actionButton}
            leftIcon={
              type === 'my-course' ? (
                <Icon name="trash2" size={18} color="var(--color-red-500)" strokeWidth={1.75} />
              ) : (
                <Icon name="heart" size={18} color="var(--color-red-500)" strokeWidth={1.75} />
              )
            }
            onClick={onSecondaryActionClick}
            disabled={secondaryActionDisabled}
          >
            {type === 'my-course' ? '삭제' : '좋아요 취소'}
          </Button>
        </section>
      ) : null}
    </article>
  );
}

export default Card;
