export interface AutoFillConfig {
  userId: string;
  enabled: boolean;
  expired: boolean;
  projectId: string;
  projectTitle: string;
  projectStatus: number;
  itemId: string;
  itemName: string;
  hours: number;
  work: string;
  deadline: string | null;
  lastExecutedAt: string | null;
  lastExecutionStatus: 'success' | 'failed' | 'skipped' | 'expired' | null;
}
