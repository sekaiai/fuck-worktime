export interface AutoFillConfig {
  userId: string;
  enabled: boolean;
  expired: boolean;
  projectId: string;
  projectTitle: string;
  projectStatus: number;
  workTypeGroupId?: string;
  workTypeGroupName?: string;
  itemId: string;
  itemName: string;
  hours: number;
  work: string;
  reportTime: string;
  deadline: string | null;
  lastExecutedAt: string | null;
  lastExecutionStatus: 'success' | 'failed' | 'skipped' | 'expired' | null;
}
