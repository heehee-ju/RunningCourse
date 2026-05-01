'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useRef, useTransition } from 'react';

import { deleteCourseAction } from '@/actions/course.action';
import { useModal } from '@/commons/providers/modal/modal.provider';

export function useDeleteCourse() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { openModal, closeModal } = useModal();
  const isSubmittingRef = useRef(false);

  const deleteCourse = useCallback(
    (routeId: string) => {
      openModal({
        type: 'confirm',
        title: '코스를 삭제하시겠습니까?',
        confirmText: '삭제',
        cancelText: '취소',
        closeOnConfirm: false,
        onConfirm: () => {
          if (isSubmittingRef.current) {
            return;
          }
          isSubmittingRef.current = true;

          startTransition(async () => {
            try {
              const result = await deleteCourseAction(routeId);

              closeModal();

              if (result.success) {
                openModal({
                  type: 'alert',
                  title: '코스가 삭제되었습니다.',
                });
                router.refresh();
                return;
              }

              openModal({
                type: 'alert',
                title: result.error ?? '코스 삭제에 실패했습니다. 다시 시도해 주세요.',
              });
            } finally {
              isSubmittingRef.current = false;
            }
          });
        },
      });
    },
    [closeModal, openModal, router],
  );

  return {
    isDeleting: isPending,
    deleteCourse,
    closeDeleteModal: closeModal,
  };
}
