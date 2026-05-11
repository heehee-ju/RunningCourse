import Image from 'next/image';

import { Button } from '@/commons/components/button';
import { Icon } from '@/commons/components/icons';
import { LogoIcon } from '@/commons/components/icons/logo';
import { LOGO_SIZE_PRESETS } from '@/commons/components/icons/logo-presets';

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
  thumbnailUrl?: string;
  readonlyLike?: boolean;
  onLikeClick?: () => void;
  onPrimaryActionClick?: () => void;
  primaryActionLabel?: string;
  onSecondaryActionClick?: () => void;
  secondaryActionLabel?: string;
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
const CARD_THUMBNAIL_LOGO_SIZE = LOGO_SIZE_PRESETS.cardThumbnail;

export function Card({
  className,
  type,
  isLiked,
  isSelected,
  title = '한강 러닝 코스',
  location = '여의도 한강공원',
  distanceText = '5km',
  likeCount = 234,
  thumbnailUrl,
  readonlyLike = false,
  onLikeClick,
  onPrimaryActionClick,
  primaryActionLabel,
  onSecondaryActionClick,
  secondaryActionLabel,
  secondaryActionDisabled = false,
}: CardProps) {
  const showActions = type === 'my-course' || type === 'liked-course';
  const resolvedPrimaryActionLabel =
    primaryActionLabel ?? (type === 'my-course' ? '수정' : '상세보기');
  const resolvedSecondaryActionLabel =
    secondaryActionLabel ?? (type === 'my-course' ? '삭제' : '좋아요 취소');

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
          {thumbnailUrl ? (
            <Image src={thumbnailUrl} alt="" fill className={styles.thumbnailImage} />
          ) : (
            <span className={styles.thumbnailPlaceholder}>
              <LogoIcon
                width={CARD_THUMBNAIL_LOGO_SIZE.width}
                height={CARD_THUMBNAIL_LOGO_SIZE.height}
              />
            </span>
          )}
        </div>

        <div className={styles.content}>
          <div className={styles.contentInfo}>
            <div className={styles.contentTop}>
              <h3 className={styles.title}>{title}</h3>
              {onLikeClick && !readonlyLike ? (
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

          <p className={styles.distance}>
            <span className={styles.distanceLabel}>총 거리</span>
            <span className={styles.distanceValue}>{distanceText}</span>
          </p>
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
              type === 'my-course' && resolvedPrimaryActionLabel === '수정' ? (
                <Icon name="pencil" size={18} color="var(--color-black-300)" strokeWidth={1.75} />
              ) : undefined
            }
            onClick={onPrimaryActionClick}
          >
            {resolvedPrimaryActionLabel}
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
            {resolvedSecondaryActionLabel}
          </Button>
        </section>
      ) : null}
    </article>
  );
}

export default Card;
