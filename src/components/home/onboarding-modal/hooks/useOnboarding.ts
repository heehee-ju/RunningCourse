'use client';

import { useEffect, useState } from 'react';

const TOTAL_STEPS = 3;
const STORAGE_KEY = 'hasSeenOnboarding';

export function useOnboarding() {
  const [step, setStep] = useState(1);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setIsVisible(true);
    }
  }, []);

  function close() {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);
  }

  return {
    isVisible,
    step,
    totalSteps: TOTAL_STEPS,
    close,
    goNext: () => setStep((s) => Math.min(s + 1, TOTAL_STEPS)),
    goPrev: () => setStep((s) => Math.max(s - 1, 1)),
  };
}
