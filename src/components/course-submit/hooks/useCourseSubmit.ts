'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { createCourseAction, updateCourseAction } from '@/actions/course.action';
import { uploadCourseImages } from '@/commons/utils/storage.util';
import type { SaveRoutePayload } from '@/components/tmap/course-submit/hooks/useCourseMap';
import type { CourseDetailPayload } from '@/services/course/courseDetailService';

import type { ChangeEvent } from 'react';

export const MAX_COURSE_SUBMIT_IMAGES = 5;

export type UseCourseSubmitParams = {
  mode: 'new' | 'edit';
  courseId?: string;
  /** 수정 모드에서 서버에서 받은 코스 상세(폼 초기값) */
  initialData?: CourseDetailPayload;
};

export type RouteData = SaveRoutePayload;

function toPathDataRecord(data: RouteData): Record<string, unknown> {
  const detailedPath = data.pathData.path.map(({ lat, lng }) => ({ lat, lng }));
  return {
    // DB에는 도보 경로의 상세 좌표를 우선 저장한다.
    path: detailedPath,
    waypoint_points: data.pathData.points.map(({ lat, lng }) => ({ lat, lng })),
    path_source: 'pedestrianRoute.path',
  };
}

/** Tmap `saveRoute` 이후 페이로드에 시작점·거리가 모두 유효한지 확인한다. */
export function isRouteDataCompleteForSubmit(data: RouteData | null): data is RouteData {
  if (!data) return false;

  const { startPoint, totalDistanceKm, pathData } = data;

  if (!pathData?.points?.length || !pathData?.path?.length) {
    return false;
  }

  if (!startPoint || typeof startPoint.lat !== 'number' || typeof startPoint.lng !== 'number') {
    return false;
  }
  if (!Number.isFinite(startPoint.lat) || !Number.isFinite(startPoint.lng)) {
    return false;
  }

  if (typeof totalDistanceKm !== 'number' || !Number.isFinite(totalDistanceKm)) {
    return false;
  }

  return true;
}

export function useCourseSubmit({ mode, courseId, initialData }: UseCourseSubmitParams) {
  const router = useRouter();
  const [courseName, setCourseName] = useState('');
  const [description, setDescription] = useState('');
  /** 편집 시 서버에 이미 저장된 이미지 URL (신규 업로드와 합쳐 수정 요청에 사용) */
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [images, setImages] = useState<File[]>([]);
  /** `images`와 동기화된 blob 미리보기 URL — 언마운트·의존성 변경 시 revoke */
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [routeData, setRouteData] = useState<RouteData | null>(null);

  useEffect(() => {
    if (!initialData?.course) {
      return;
    }
    const { title, description: desc, image_urls } = initialData.course;
    setCourseName(title ?? '');
    setDescription(typeof desc === 'string' ? desc : '');
    setExistingImageUrls(Array.isArray(image_urls) ? [...image_urls] : []);
  }, [initialData]);

  useEffect(() => {
    const nextUrls = images.map((file) => URL.createObjectURL(file));
    setImagePreviewUrls(nextUrls);

    return () => {
      nextUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [images]);

  const handleSaveRoute = useCallback((data: SaveRoutePayload) => {
    const normalized: RouteData = {
      totalDistanceKm: Number(data.totalDistanceKm),
      pathData: {
        points: data.pathData.points.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) })),
        path: data.pathData.path.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) })),
      },
      startPoint: {
        lat: Number(data.startPoint.lat),
        lng: Number(data.startPoint.lng),
      },
    };

    if (!isRouteDataCompleteForSubmit(normalized)) {
      console.warn('[useCourseSubmit] Tmap 경로 데이터가 불완전합니다.', data);
      return;
    }

    setRouteData(normalized);
  }, []);

  const handleImageInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;

      const selectedFiles = Array.from(files);

      setImages((prevImages) => {
        const currentTotal = existingImageUrls.length + prevImages.length;
        const remaining = MAX_COURSE_SUBMIT_IMAGES - currentTotal;
        if (remaining <= 0) {
          return prevImages;
        }
        const allowedFiles = selectedFiles.slice(0, remaining);
        return [...prevImages, ...allowedFiles];
      });

      e.target.value = '';
    },
    [existingImageUrls],
  );

  const handleRemoveExistingImage = useCallback((index: number) => {
    setExistingImageUrls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const removeImageAt = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const isSubmitEnabled =
    mode === 'edit'
      ? courseName.trim().length > 0
      : courseName.trim().length > 0 && isRouteDataCompleteForSubmit(routeData);

  const handleSubmit = useCallback(async () => {
    const title = courseName.trim();

    if (mode === 'edit') {
      if (!title || !courseId?.trim()) return;

      try {
        const uploadedUrls = await uploadCourseImages(images);
        const image_urls = [...existingImageUrls, ...uploadedUrls];

        const result = await updateCourseAction({
          courseId: courseId.trim(),
          title,
          description: description.trim() || null,
          image_urls,
        });

        if (!result.success) {
          window.alert(result.error);
          return;
        }

        router.push(`/courses/${courseId.trim()}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '코스 수정 중 오류가 발생했습니다.';
        window.alert(message);
      }
      return;
    }

    if (!title || !isRouteDataCompleteForSubmit(routeData)) return;

    try {
      const imageUrls = await uploadCourseImages(images);
      const result = await createCourseAction({
        title,
        description: description.trim() || null,
        routeData: {
          totalDistanceKm: routeData.totalDistanceKm,
          pathData: toPathDataRecord(routeData),
          startPoint: {
            lat: routeData.startPoint.lat,
            lng: routeData.startPoint.lng,
          },
        },
        imageUrls,
      });

      if (result && !result.success) {
        window.alert(result.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '코스 등록 중 오류가 발생했습니다.';
      window.alert(message);
    }
  }, [courseName, courseId, description, existingImageUrls, images, mode, routeData, router]);

  return {
    courseName,
    setCourseName,
    description,
    setDescription,
    existingImageUrls,
    images,
    imagePreviewUrls,
    routeData,
    handleSaveRoute,
    handleImageInputChange,
    handleRemoveExistingImage,
    removeImageAt,
    handleSubmit,
    isSubmitEnabled,
  };
}
