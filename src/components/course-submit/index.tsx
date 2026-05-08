/*
 * CourseSubmit Component — index.tsx
 * 버전: 1.0.0 · 생성: 2026-04-16
 * 체크리스트:
 * - [x] tailwind.config 미수정
 * - [x] 하드코딩 색상값: 디자인 토큰 매칭 불가 시 하드코딩 후 주석 처리
 * - [x] 인라인 스타일 0건
 * - [x] index.tsx → 구조 / styles.module.css → 스타일 분리
 * - [x] CSS Module 사용 확인: import styles from './styles.module.css'
 * - [x] CSS 변수 사용 확인
 * - [x] 피그마 구조 대비 누락 섹션 없음 (헤더 / 지도 / 폼 / 제출버튼)
 * - [x] 소수점 값 반올림 완료
 * - [x] flexbox 기반 레이아웃 / 이미지 썸네일 배지는 relative/absolute 허용
 * - [x] Button, Input, Label, Icon 공통 컴포넌트 사용
 */

'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';

import { Button } from '@/commons/components/button';
import { Icon } from '@/commons/components/icons';
import Input from '@/commons/components/input';
import { Label } from '@/commons/components/input/label';
import Tooltip from '@/commons/components/tooltip';
import { Header } from '@/commons/layout/header';
import { useModal } from '@/commons/providers/modal/modal.provider';
import { TmapCourseDetail } from '@/components/tmap/course-detail';
import TmapCourseSubmit from '@/components/tmap/course-submit';
import type { CourseDetailPayload } from '@/services/course/courseDetailService';

import { MAX_COURSE_SUBMIT_IMAGES, useCourseSubmit } from './hooks/useCourseSubmit';
import styles from './styles.module.css';

// i18n 대비 텍스트 상수 분리
const TEXTS = {
  TITLE_NEW: '코스 등록',
  TITLE_EDIT: '코스 수정',
  BACK_ARIA: '뒤로 가기',
  DELETE_ARIA: '코스 삭제',
  LABEL_COURSE_NAME: '코스명',
  LABEL_DESCRIPTION: '설명',
  LABEL_IMAGE_UPLOAD: '이미지 업로드',
  TOOLTIP_DESCRIPTION: '코스의 분위기, 난이도, 추천 시간 등을 자유롭게 작성해 주세요.',
  TOOLTIP_IMAGE_UPLOAD: '출발지·경유지·도착지 이미지를 올려보세요.',
  PLACEHOLDER_COURSE_NAME: '코스명을 입력하세요.',
  PLACEHOLDER_DESCRIPTION: '코스에 대한 설명을 입력하세요',
  MAP_PLACEHOLDER: '[MAP]',
  /** 코스 수정 화면 읽기 전용 지도(스크린리더) */
  MAP_PREVIEW_LABEL: '등록된 코스 경로',
  BUTTON_NEW: '등록하기',
  BUTTON_EDIT: '수정하기',
  CONFIRM_NEW_TITLE: '코스를 등록하시겠습니까?',
  CONFIRM_EDIT_TITLE: '코스를 수정하시겠습니까?',
  CONFIRM_BUTTON: '확인',
} as const;

interface CourseSubmitProps {
  mode: 'new' | 'edit';
  courseId?: string;
  /** 수정 모드에서 서버에서 패칭한 코스 상세(편집 폼 초기값) */
  initialData?: CourseDetailPayload;
}

export default function CourseSubmit({ mode, courseId, initialData }: CourseSubmitProps) {
  const router = useRouter();
  const { openModal } = useModal();

  const {
    courseName,
    setCourseName,
    description,
    setDescription,
    existingImageUrls,
    images,
    imagePreviewUrls,
    handleSaveRoute,
    handleImageInputChange,
    handleRemoveExistingImage,
    removeImageAt,
    handleSubmit,
    isSubmitEnabled,
  } = useCourseSubmit({ mode, courseId, initialData });

  const totalImageCount = existingImageUrls.length + images.length;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = mode === 'edit';
  const showReadOnlyRouteMap = isEdit && initialData != null;
  const pageTitle = isEdit ? TEXTS.TITLE_EDIT : TEXTS.TITLE_NEW;
  const submitLabel = isEdit ? TEXTS.BUTTON_EDIT : TEXTS.BUTTON_NEW;

  const openSubmitConfirmModal = () => {
    openModal({
      type: 'confirm',
      title: isEdit ? TEXTS.CONFIRM_EDIT_TITLE : TEXTS.CONFIRM_NEW_TITLE,
      confirmText: TEXTS.CONFIRM_BUTTON,
      onConfirm: () => {
        void handleSubmit();
      },
    });
  };

  return (
    <div className={styles.container}>
      <Header title={pageTitle} showRightIcon={false} onLeftIconClick={() => router.back()} />

      {/* 지도: 신규는 편집 가능 Tmap, 수정+초기값 있음은 읽기 전용 미리보기 */}
      <div className={styles.mapArea} aria-label="지도 영역">
        <div className={styles.mapSlot}>
          {showReadOnlyRouteMap ? (
            <TmapCourseDetail
              key={initialData.course.id}
              course={initialData.course}
              mapLabel={TEXTS.MAP_PREVIEW_LABEL}
            />
          ) : (
            <TmapCourseSubmit onSaveRoute={handleSaveRoute} />
          )}
        </div>
      </div>

      {/* 폼 섹션 */}
      <div className={styles.formSection}>
        {/* 코스명 (필수) */}
        <Input.Root className={styles.fieldGroup}>
          <Input.Label type="required">{TEXTS.LABEL_COURSE_NAME}</Input.Label>
          <Input.Field
            placeholder={TEXTS.PLACEHOLDER_COURSE_NAME}
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
          />
        </Input.Root>

        {/* 설명 (선택·정보) */}
        <div className={styles.fieldGroup}>
          <div className={styles.infoLabelRow}>
            <Label type="optional">{TEXTS.LABEL_DESCRIPTION}</Label>
            <Tooltip content={TEXTS.TOOLTIP_DESCRIPTION}>
              <button type="button" className={styles.infoButton} aria-label="설명 도움말">
                <Icon name="info" size={14} color="var(--color-grey-600)" />
              </button>
            </Tooltip>
          </div>
          <textarea
            className={styles.textarea}
            placeholder={TEXTS.PLACEHOLDER_DESCRIPTION}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-label={TEXTS.LABEL_DESCRIPTION}
          />
        </div>

        {/* 이미지 업로드 (선택·정보) */}
        <div className={`${styles.fieldGroup} ${styles.fieldGroupNoGap}`}>
          <div className={styles.infoLabelRow}>
            <Label type="optional">{TEXTS.LABEL_IMAGE_UPLOAD}</Label>
            <Tooltip content={TEXTS.TOOLTIP_IMAGE_UPLOAD}>
              <button type="button" className={styles.infoButton} aria-label="이미지 업로드 도움말">
                <Icon name="info" size={14} color="var(--color-grey-600)" />
              </button>
            </Tooltip>
          </div>
          <div className={styles.imageList}>
            <div className={styles.imageAddColumn}>
              <button
                type="button"
                className={styles.addImageButton}
                disabled={totalImageCount >= MAX_COURSE_SUBMIT_IMAGES}
                onClick={() => fileInputRef.current?.click()}
                aria-label="이미지 추가"
              >
                <span className={styles.addImageCircle}>
                  <Icon name="plus" size={12} color="var(--color-grey-300)" />
                </span>
                <span className={styles.addImageCount}>
                  {totalImageCount}/{MAX_COURSE_SUBMIT_IMAGES}
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className={styles.fileInput}
                onChange={handleImageInputChange}
                aria-hidden="true"
              />
            </div>
            <div className={styles.imageListScroll}>
              {/* 서버에 저장된 기존 이미지 (수정 모드) */}
              {existingImageUrls.map((url, idx) => (
                <div key={`existing-${url}-${idx}`} className={styles.imageItem}>
                  {/* 외부 스토리지 URL — Next/Image 도메인 설정 없이 표시 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`등록된 이미지 ${idx + 1}`}
                    className={styles.imageThumb}
                    width={80}
                    height={80}
                  />
                  <button
                    type="button"
                    className={styles.deleteImageButton}
                    onClick={() => handleRemoveExistingImage(idx)}
                    aria-label={`등록된 이미지 ${idx + 1} 삭제`}
                  >
                    <Icon name="minus" size={12} color="var(--color-white-500)" />
                  </button>
                </div>
              ))}
              {/* 새로 선택한 이미지 목록 */}
              {imagePreviewUrls.map((src, idx) => (
                <div key={`${src}-${idx}`} className={styles.imageItem}>
                  <Image
                    src={src}
                    alt={`업로드 이미지 ${idx + 1}`}
                    className={styles.imageThumb}
                    width={80}
                    height={80}
                  />
                  <button
                    type="button"
                    className={styles.deleteImageButton}
                    onClick={() => removeImageAt(idx)}
                    aria-label={`이미지 ${idx + 1} 삭제`}
                  >
                    <Icon name="minus" size={12} color="var(--color-white-500)" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 제출 버튼 */}
        <div className={styles.submitArea}>
          <Button
            variant="fill"
            borderRadius="r12"
            size="medium"
            color="dark"
            disabled={!isSubmitEnabled}
            className={styles.submitButton}
            onClick={openSubmitConfirmModal}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
