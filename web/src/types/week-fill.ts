/**
 * 周填报表单的草稿行。
 *
 * 与 TimesheetEntry 的区别：
 * - 带 rowId 用于列表 key 与行内操作定位（TimesheetEntry 无主键）
 * - 带 sourceId：非空表示该行来自已提交记录（WorkDetail.id），提交时走更新而非新建
 * - 字段允许为空字符串/0，校验在提交前统一做（TimesheetEntry 是校验后的产物）
 */
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
