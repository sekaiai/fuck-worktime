export interface WeekDay {
  date: string;
  dayOfWeek: string;
  isWeekend: boolean;
  status: string;
  displayStatus: string;
  totalHours: number;
  details: WorkDetail[];
}

export interface WorkDetail {
  id: string;
  period: string;
  hours: number;
  content: string;
  status: string;
  statusDesc: string;
  /** 上游可能不返回；缺失时草稿行回落到默认值 */
  projectId?: string;
  /** 工时类型 id，同上 */
  itemId?: string;
}

export interface WeekBoardResponse {
  weekRange?:string;
  days: WeekDay[];
  userName?: string;
  deptName?: string;
  totalHours: number;
  weekNumber?: number;
  reportPeriod?: string;
  currentWeek?: string;
}

export interface Project {
  id: string;
  title: string;
  projectStatus: number;
}

export interface WorkTypeNode {
  id: string;
  name: string;
  level: number;
  parentId: string | null;
  children?: WorkTypeNode[];
  extraFields?: {
    selected?: boolean;
  };
}

export interface TimesheetEntry {
  reportDate: string;
  projectId: string;
  projectTitle: string;
  projectStatus: number;
  itemId: string;
  itemName?: string;
  content: string;
  hours: number;
}

export interface ReportBatchRequest {
  workingTimingList: TimesheetEntry[];
}
