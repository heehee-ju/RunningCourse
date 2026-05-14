/**
 * Courses — 코스 상세 검색 UI
 * 버전: 2.0.0 · 수정: 2026-04-16
 * 체크리스트:
 * - [x] CSS Module 클래스만 사용
 * - [x] 텍스트 상수 분리
 * - [x] 공용 Icon 컴포넌트만 사용
 * - [x] 인라인 스타일 미사용
 * - [x] 피그마 메타데이터 구조 기준으로 섹션 반영
 * - [x] 캐러셀/찜 상태 UI 반영
 */

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { A11y, Navigation } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';

import 'swiper/css';
import 'swiper/css/navigation';

import { Icon } from '@/commons/components/icons';
import { ROUTES } from '@/commons/constants/url';
import { Header } from '@/commons/layout/header';
import { useToast } from '@/commons/providers/toast/toast.provider';
import type { Route } from '@/commons/types/runroute';
import { formatDistanceKm as formatCourseDistanceKm } from '@/commons/utils/distance/format';
import { filterNonemptyImageUrls } from '@/commons/utils/image/filter';
import { getCourseDescriptionDisplay } from '@/commons/utils/text/display';
import { TmapCourseDetail } from '@/components/tmap/course-detail';

import { COURSES_DETAIL_COPY as COPY } from './constants/copy';
import { useCourseDetailLikes } from './hooks/use-course-detail-likes';
import styles from './styles.module.css';
import { buildCarouselNavButtonClassNames } from './utils/course-detail-display';

type CoursesDetailProps = {
  course: Route;
  authorNickname: string;
  location: string;
  canEdit?: boolean;
};

export function Courses({ course, authorNickname, location, canEdit = false }: CoursesDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const distanceText = formatCourseDistanceKm(course.distance_meters);
  const { showToast } = useToast();
  const { isCourseLiked, getCourseLikeCount, toggleCourseLike } = useCourseDetailLikes(course);
  const isLiked = isCourseLiked(course.id);
  const likesCount = getCourseLikeCount(course.id);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  useEffect(() => {
    if (searchParams.get('registered') !== 'true') return;
    showToast('코스 등록이 완료되었습니다!', 'success');
    router.replace(`/courses/${course.id}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    showToast('링크가 복사되었습니다', 'success');
  };
  const descriptionText = getCourseDescriptionDisplay(course.description, COPY.emptyDescription);
  const imageUrls = filterNonemptyImageUrls(course.image_urls);
  const hasImages = imageUrls.length > 0;
  const carouselLabels = imageUrls.map((_, idx) => `코스 이미지 ${idx + 1}`);
  const { prev: prevButtonClass, next: nextButtonClass } = buildCarouselNavButtonClassNames(
    course.id,
  );

  return (
    <main className={styles.container}>
      <Header
        title="코스 상세"
        showRightIcon={canEdit}
        rightIconName="pencil"
        rightIconAriaLabel="코스 수정"
        onRightIconClick={() => {
          router.push(ROUTES.COURSES.EDIT(course.id));
        }}
        onLeftIconClick={() => {
          router.back();
        }}
      />
      <div className={styles.scrollArea}>
        <section className={styles.mapPreview} aria-label={COPY.mapPreview}>
          <TmapCourseDetail key={course.id} course={course} mapLabel={COPY.mapPreview} />
        </section>

        <article className={styles.content}>
          <section className={styles.userSection} aria-label="작성자 정보">
            <div className={styles.userRow}>
              <div className={styles.avatarWrap} aria-hidden>
                <Icon name="userRound" color="var(--color-white-500)" />
              </div>
              <p className={styles.userName}>{authorNickname}</p>
            </div>
          </section>

          <section className={styles.summarySection} aria-label="코스 요약 정보">
            <div className={styles.titleRow}>
              <h2 className={styles.courseTitle}>{course.title}</h2>
              <div className={styles.actionsGroup}>
                <button
                  type="button"
                  className={styles.shareButton}
                  aria-label="링크 공유"
                  onClick={handleShare}
                >
                  <Icon name="share2" color="var(--color-grey-500)" />
                </button>
                <button
                  type="button"
                  className={styles.likeButton}
                  aria-pressed={isLiked}
                  aria-label={isLiked ? '코스 찜 취소' : '코스 찜하기'}
                  onClick={() => toggleCourseLike(course.id)}
                >
                  <Icon name={isLiked ? 'heartFilled' : 'heart'} color="var(--color-red-500)" />
                  <span className={styles.likeCount}>{likesCount}</span>
                </button>
              </div>
            </div>

            <div className={styles.metaRow}>
              <span className={styles.distance}>{distanceText}</span>
              <span className={styles.separator} aria-hidden>
                |
              </span>
              <span className={styles.roundTripBadge}>
                {course.is_round_trip ? '왕복코스' : '편도코스'}
              </span>
              <span className={styles.separator} aria-hidden>
                |
              </span>
              <span className={styles.locationWrap}>
                <span className={styles.locationIcon} aria-hidden>
                  <Icon name="mapPin" size={16} color="var(--color-grey-500)" />
                </span>
                <span className={styles.location}>{location}</span>
              </span>
            </div>
          </section>
          <section className={styles.descriptionSection} aria-label={COPY.descriptionTitle}>
            <h3 className={styles.sectionTitle}>{COPY.descriptionTitle}</h3>
            <p className={styles.description}>{descriptionText}</p>
          </section>

          <section className={styles.imageSection} aria-label={COPY.imageTitle}>
            <h3 className={styles.sectionTitle}>{COPY.imageTitle}</h3>
            {hasImages ? (
              <div className={styles.carousel}>
                <div className={styles.carouselViewport}>
                  <Swiper
                    className={styles.carouselTrack}
                    modules={[Navigation, A11y]}
                    spaceBetween={0}
                    slidesPerView={1}
                    navigation={{
                      prevEl: `.${prevButtonClass}`,
                      nextEl: `.${nextButtonClass}`,
                    }}
                    onSlideChange={(swiper) => setActiveSlideIndex(swiper.realIndex)}
                    aria-label="코스 이미지 캐러셀"
                  >
                    {carouselLabels.map((imageLabel, index) => {
                      return (
                        <SwiperSlide key={imageLabel} className={styles.carouselSlide}>
                          <figure
                            className={styles.carouselItem}
                            aria-label={`${COPY.imageAltPrefix} ${index + 1}`}
                          >
                            {/* 상세 코스 이미지는 외부 URL을 그대로 표시한다. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imageUrls[index]}
                              alt={`${COPY.imageAltPrefix} ${index + 1}`}
                              className={styles.carouselImage}
                            />
                            <span className={styles.carouselCaption}>{imageLabel}</span>
                          </figure>
                        </SwiperSlide>
                      );
                    })}
                  </Swiper>

                  <div className={styles.carouselControls}>
                    <button
                      type="button"
                      className={`${styles.carouselButton} ${prevButtonClass}`}
                      aria-label={COPY.previousImage}
                    >
                      <Icon name="chevronLeft" size={16} color="var(--color-black-900)" />
                    </button>
                    <button
                      type="button"
                      className={`${styles.carouselButton} ${nextButtonClass}`}
                      aria-label={COPY.nextImage}
                    >
                      <Icon name="chevronRight" size={16} color="var(--color-black-900)" />
                    </button>
                  </div>

                  <div className={styles.carouselIndicators} aria-label="이미지 위치 표시">
                    {imageUrls.map((_, index) => (
                      <span
                        key={`indicator-${index + 1}`}
                        className={
                          index === activeSlideIndex ? styles.indicatorActive : styles.indicator
                        }
                        aria-hidden
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.emptyImageCard} role="status" aria-live="polite">
                <p className={styles.emptyImageTitle}>{COPY.emptyImageTitle}</p>
              </div>
            )}
          </section>
        </article>
      </div>
    </main>
  );
}

export default Courses;
