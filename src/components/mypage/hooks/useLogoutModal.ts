'use client';

import { useCallback, useMemo, useState } from 'react';

export type LogoutModalData = {
  title: string;
  content: string;
};

export type UseLogoutModalReturn = {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  handleConfirm: () => Promise<void>;
  modalData: LogoutModalData;
};

export function useLogoutModal(
  isAnonymous: boolean,
  executeLogoutOrDelete: (isAnonymous: boolean) => void | Promise<void>,
): UseLogoutModalReturn {
  const [isOpen, setIsOpen] = useState(false);

  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const modalData = useMemo<LogoutModalData>(
    () =>
      isAnonymous
        ? {
            title: '게스트 로그아웃',
            content: '게스트 로그아웃 시 계정이 삭제됩니다. 진행하시겠습니까?',
          }
        : {
            title: '로그아웃',
            content: '로그아웃 하시겠습니까?',
          },
    [isAnonymous],
  );

  const handleConfirm = useCallback(async () => {
    await executeLogoutOrDelete(isAnonymous);
    closeModal();
  }, [executeLogoutOrDelete, isAnonymous, closeModal]);

  return {
    isOpen,
    openModal,
    closeModal,
    handleConfirm,
    modalData,
  };
}
