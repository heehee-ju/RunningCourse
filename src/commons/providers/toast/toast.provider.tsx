'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { Toast } from '@/commons/components/toast';

import styles from './toast.provider.module.css';

// ─── 타입 ──────────────────────────────────────────────────────────────────────

interface ToastItem {
  id: number;
  message: string;
  state: 'success' | 'failed';
}

interface ToastContextValue {
  showToast: (message: string, state?: 'success' | 'failed', duration?: number) => void;
}

// ─── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string, state: 'success' | 'failed' = 'success', duration = 1500) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setToast({ id: Date.now(), message, state });
      timerRef.current = setTimeout(() => {
        setToast(null);
      }, duration);
    },
    [],
  );

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof window !== 'undefined' &&
        toast !== null &&
        createPortal(
          <div key={toast.id} className={styles.toastOverlay}>
            <Toast state={toast.state} message={toast.message} />
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast는 ToastProvider 내부에서만 사용할 수 있습니다.');
  }
  return ctx;
}
