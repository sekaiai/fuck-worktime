/**
 * 周填报表单的草稿行。
 *
 * 与 TimesheetEntry 的区别：
 * - 带 rowId 用于列表 key 与行内操作定位（TimesheetEntry 无主键）
 * - 带 sourceId：非空表示该行来自可编辑的已有明细（WorkDetail.id），提交时走 flow 重新提交
 * - 字段允许为空字符串/0，校验在提交前统一做（TimesheetEntry 是校验后的产物）
 *
 * 提交结果类型（WeekFillSubmit*）同属周填报域：
 * 单行按 mode 走 flow 三步或 reportBatch 一步，每步响应记入 steps；
 * 整次结果 WeekFillSubmitResult 顶层沿用 gzdata 的 code/msg/data 约定（ReportActionResponse）
 */
import type { ReportActionResponse } from './timesheet';

export interface WeekFillDraftRow {
  rowId: string;
  reportDate: string;
  sourceId: string | null;
  projectId: string;
  projectTitle: string;
  projectStatus: number;
  itemId: string;
  itemName: string;
  hours: number;
  content: string;
  /** 上游明细原始展示字段，草稿同步时不参与提交校验 */
  period?: string;
  status?: string;
  statusDesc?: string;
}

/** 新增行的初始值，来源见 utils/week-fill-defaults.ts */
export interface WeekFillDefaults {
  projectId: string;
  projectTitle: string;
  projectStatus: number;
  itemId: string;
  itemName: string;
  hours: number;
  work: string;
}

/** 单行的硬错误，用于提交拦截与行内高亮 */
export interface WeekFillRowError {
  rowId: string;
  reportDate: string;
  message: string;
}

/** 单行提交模式：已有可编辑明细走 flow 重提，新草稿走 reportBatch 批量提交 */
export type WeekFillSubmitMode = 'flow' | 'reportBatch';

/** 提交步骤名，对应 flow 的三步或 reportBatch 的一步 */
export type WeekFillSubmitStepName = 'flow' | 'buttons' | 'handle' | 'reportBatch';

/** 单步执行结果，字段结构同 ReportActionResponse */
export interface WeekFillSubmitStep {
  name: WeekFillSubmitStepName;
  code: number;
  msg: string;
  data: unknown | null;
}

/** 单行提交结果，steps 逐步记录该行的上游响应 */
export interface WeekFillSubmitItem {
  rowId: string;
  reportDate: string;
  mode: WeekFillSubmitMode;
  success: boolean;
  steps: WeekFillSubmitStep[];
  errorMessage?: string;
}

/** 整次提交结果，顶层沿用 gzdata 响应约定，items 逐行记录结果 */
export interface WeekFillSubmitResult extends ReportActionResponse {
  items: WeekFillSubmitItem[];
}
