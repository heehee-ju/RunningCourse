'use client';

import { useState } from 'react';

const TOTAL_STEPS = 3;

export function useOnboarding() {
  const [step, setStep] = useState(1);

  return {
    step,
    totalSteps: TOTAL_STEPS,
    goNext: () => setStep((s) => Math.min(s + 1, TOTAL_STEPS)),
    goPrev: () => setStep((s) => Math.max(s - 1, 1)),
  };
}
