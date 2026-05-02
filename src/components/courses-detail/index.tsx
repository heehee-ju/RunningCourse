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

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { A11y, Navigation } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';

import 'swiper/css';
import 'swiper/css/navigation';

import { Icon } from '@/commons/components/icons';
import { ROUTES } from '@/commons/constants/url';
import { Header } from '@/commons/layout/header';
import type { Route } from '@/commons/types/runroute';
import { useCourseLikes } from '@/hooks/useCourseLikes';

import CourseDetailMapPreview from './CourseDetailMapPreview';
import styles from './styles.module.css';

const COPY = {
  mapPreview: '[MAP PREVIEW]',
  descriptionTitle: '코스 설명',
  imageTitle: '코스 이미지',
  imageAltPrefix: '코스 이미지',
  emptyImageTitle: '등록된 코스 이미지가 없어요',
  previousImage: '이전 이미지',
  nextImage: '다음 이미지',
} as const;

type CoursesDetailProps = {
  course: Route;
  authorNickname: string;
  location: string;
  /** 로그인한 사용자가 이 코스 작성자일 때만 헤더 수정 버튼 표시 */
  canEdit?: boolean;
};

export function Courses({ course, authorNickname, location, canEdit = false }: CoursesDetailProps) {
  const router = useRouter();
  const distanceText = `${(course.distance_meters / 1000).toFixed(1)}km`;
  const courseLikeCounts = useMemo(
    () => ({ [course.id]: course.likes_count ?? 0 }),
    [course.id, course.likes_count],
  );
  const { isCourseLiked, getCourseLikeCount, toggleCourseLike } = useCourseLikes(courseLikeCounts);
  const isLiked = isCourseLiked(course.id);
  const likesCount = getCourseLikeCount(course.id);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const descriptionText = course.description?.trim() || '설명이 없습니다.';
  const imageUrls = course.image_urls.filter((url) => url.trim().length > 0);
  const hasImages = imageUrls.length > 0;
  const carouselLabels = imageUrls.map((_, idx) => `코스 이미지 ${idx + 1}`);
  const safeCourseClassToken = course.id.replace(/[^a-zA-Z0-9_-]/g, '-');
  const nextButtonClass = `course-detail-next-${safeCourseClassToken}`;
  const prevButtonClass = `course-detail-prev-${safeCourseClassToken}`;

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
          // history.length는 브라우저별 추정치라 신뢰하면 안 됨(오탐 시 홈으로만 이동하는 버그).
          // 마이페이지·홈 등 이전 페이지는 브라우저 세션 스택의 router.back()으로 복귀한다.
          router.back();
        }}
      />
      <div className={styles.scrollArea}>
        <section className={styles.mapPreview} aria-label={COPY.mapPreview}>
          <CourseDetailMapPreview key={course.id} course={course} mapLabel={COPY.mapPreview} />
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
            <div className={styles.titleBlock}>
              <h2 className={styles.courseTitle}>{course.title}</h2>
              <div className={styles.metaRow}>
                <span className={styles.distance}>{distanceText}</span>
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
            </div>

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
                <span className={styles.emptyImageIcon} aria-hidden>
                  ...
                </span>
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
