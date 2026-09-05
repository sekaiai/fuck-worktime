const DAILY_TARGET_HOURS = 8;

export function calculateRemainingHours(submittedHours: number, newDraftHours: number): number {
  const submitted = Number.isFinite(submittedHours) ? Math.max(0, submittedHours) : 0;
  const draft = Number.isFinite(newDraftHours) ? Math.max(0, newDraftHours) : 0;
  return Math.max(0, Number((DAILY_TARGET_HOURS - submitted - draft).toFixed(1)));
}
