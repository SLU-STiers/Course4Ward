import { useState } from 'react';
import type { SummaryModel } from '../types';

const MODEL_STORAGE_KEY = 'course4ward.summaryModel';

/** The physician's chosen AI model, remembered in this browser when it can be. */
export function useSummaryModel() {
  const [model, setModel] = useState<SummaryModel>(() => {
    try {
      return localStorage.getItem(MODEL_STORAGE_KEY) === 'fine_tuned' ? 'fine_tuned' : 'standard';
    } catch {
      return 'standard';
    }
  });
  const choose = (next: SummaryModel) => {
    setModel(next);
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, next);
    } catch {
      // Storage blocked: the choice still applies until the page reloads.
    }
  };
  return [model, choose] as const;
}
