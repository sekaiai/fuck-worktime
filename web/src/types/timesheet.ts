export interface WeekDay {
  date: string;
  dayOfWeek: string;
  isWeekend: boolean;
  status: string;
  displayText: string;
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
  /** 明细接口可能直接返回项目展示字段 */
  projectTitle?: string;
  projectStatus?: number;
  /** 工时类型 id，同上 */
  itemId?: string;
  /** 工时类型展示名称，同上 */
  itemName?: string;
}

export interface WeekBoardResponse {
  weekRange?: string;
  monday?: string;
  sunday?: string;
  days: WeekDay[];
  userName?: string;
  deptName?: string;
  totalHours: number;
  workDays?: number;
  averageHours?: number;
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

export interface ReportActionResponse {
  code: number;
  msg: string;
  data: unknown | null;
}

export interface ReportFlowStartResponse extends ReportActionResponse {
  taskId: string | null;
}

export interface ReportFlowButtonsResponse extends ReportActionResponse {
  buttonKey: string | null;
}
