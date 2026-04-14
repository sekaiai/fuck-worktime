import { shallowRef, type ShallowRef } from 'vue';

import type { WeekDay } from '../types/timesheet';

export interface QuickFillLauncher {
  recommendedDaysToGenerate: ShallowRef<number | null>;
  preferredReportDate: ShallowRef<string | null>;
  preferredStep: ShallowRef<1 | 2 | 3>;
  openManualFill: (fillableDays: WeekDay[]) => boolean;
  quickFillOneDay: (fillableDays: WeekDay[]) => boolean;
}

export function useQuickFillLauncher(): QuickFillLauncher {
  const recommendedDaysToGenerate = shallowRef<number | null>(null);
  const preferredReportDate = shallowRef<string | null>(null);
  const preferredStep = shallowRef<1 | 2 | 3>(1);

  function openManualFill(fillableDays: WeekDay[]): boolean {
    if (fillableDays.length === 0) {
      return false;
    }

    recommendedDaysToGenerate.value = null;
    preferredReportDate.value = null;
    preferredStep.value = 1;
    return true;
  }

  function quickFillOneDay(fillableDays: WeekDay[]): boolean {
    if (fillableDays.length === 0) {
      return false;
    }

    recommendedDaysToGenerate.value = 1;
    const sorted = [...fillableDays].sort((left, right) => right.date.localeCompare(left.date));
    preferredReportDate.value = sorted[0]?.date ?? null;
    preferredStep.value = 2;
    return true;
  }

  return {
    recommendedDaysToGenerate,
    preferredReportDate,
    preferredStep,
    openManualFill,
    quickFillOneDay,
  };
}
