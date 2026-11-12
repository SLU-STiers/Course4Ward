import { useState } from 'react';
import type { SummaryModel } from '../types';

const MODEL_STORAGE_KEY = 'course4ward.summaryModel';

/**
 * The physician's chosen AI model, remembered in this browser when it can be.
 * Defaults to the fine-tuned model until they pick another one.
 */
export function useSummaryModel() {
  const [model, setModel] = useState<SummaryModel>(() => {
    try {
      const saved = localStorage.getItem(MODEL_STORAGE_KEY);
      return saved === 'standard' || saved === 'fine_tuned_rag' ? saved : 'fine_tuned';
    } catch {
      return 'fine_tuned';
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
