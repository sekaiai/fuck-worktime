import { computed, shallowRef } from 'vue';

export interface WorkDetail {
  id: string;
  period: string;
  hours: number;
  content: string;
  status: string;
  statusDesc: string;
}

export interface WorkDay {
  dayOfWeek: string;
  date: string;
  totalHours: number;
  status: string;
  displayText: string;
  isWeekend: boolean;
  details: readonly WorkDetail[];
  displayStatus: string;
}

export interface WeeklyReportMock {
  currentWeek: string;
  weekRange: string;
  monday: string;
  sunday: string;
  days: readonly WorkDay[];
  userName: string;
  deptName: string;
  reportPeriod: string;
  weekNumber: number;
  totalHours: number;
  workDays: number;
  averageHours: number;
}

export type WeekTab = 'prev' | 'current' | 'next';

const currentWeekReport: WeeklyReportMock = {
  currentWeek: '2026年3月第13周',
  weekRange: '2026-03-23 ~ 2026-03-29',
  monday: '2026-03-23',
  sunday: '2026-03-29',
  days: [
    {
      dayOfWeek: '周一',
      date: '2026-03-23',
      totalHours: 16,
      status: '已达标部分审批',
      displayText: '16h',
      isWeekend: false,
      details: [
        {
          id: '2035272414052716547',
          period: '全天',
          hours: 8,
          content:
            '完成民政厅小程序核心页面开发，实现救助申请、进度查询、政策咨询等基础功能联调，同步对接政务数据接口。',
          status: '待审批',
          statusDesc: '待审批',
        },
        {
          id: '2038474105635966978',
          period: '全天',
          hours: 8,
          content: '完成三化四账代码备份，保障项目代码安全',
          status: '审批通过',
          statusDesc: '审批通过',
        },
      ],
      displayStatus: '16小时·已达标部分审批',
    },
    {
      dayOfWeek: '周二',
      date: '2026-03-24',
      totalHours: 8,
      status: '已达标审批通过',
      displayText: '8h',
      isWeekend: false,
      details: [
        {
          id: '2038474123012968449',
          period: '全天',
          hours: 8,
          content: '开发新增项目组件，完善前端功能模块搭建',
          status: '审批通过',
          statusDesc: '审批通过',
        },
      ],
      displayStatus: '8小时·已达标审批通过',
    },
    {
      dayOfWeek: '周三',
      date: '2026-03-25',
      totalHours: 8,
      status: '已达标审批通过',
      displayText: '8h',
      isWeekend: false,
      details: [
        {
          id: '2038474118676058114',
          period: '全天',
          hours: 8,
          content: '重构 API 命名与目录结构，规范命名并清理无用页面',
          status: '审批通过',
          statusDesc: '审批通过',
        },
      ],
      displayStatus: '8小时·已达标审批通过',
    },
    {
      dayOfWeek: '周四',
      date: '2026-03-26',
      totalHours: 8,
      status: '已达标审批通过',
      displayText: '8h',
      isWeekend: false,
      details: [
        {
          id: '2038474114347536385',
          period: '全天',
          hours: 8,
          content: '修复多处页面 API 名称错误，补充缺失函数导出',
          status: '审批通过',
          statusDesc: '审批通过',
        },
      ],
      displayStatus: '8小时·已达标审批通过',
    },
    {
      dayOfWeek: '周五',
      date: '2026-03-27',
      totalHours: 8,
      status: '已达标审批通过',
      displayText: '8h',
      isWeekend: false,
      details: [
        {
          id: '2038474110002237442',
          period: '全天',
          hours: 8,
          content: '推进三化四账项目开发，开展相关功能迭代工作',
          status: '审批通过',
          statusDesc: '审批通过',
        },
      ],
      displayStatus: '8小时·已达标审批通过',
    },
    {
      dayOfWeek: '周六',
      date: '2026-03-28',
      totalHours: 0,
      status: '休息日',
      displayText: '休息日',
      isWeekend: true,
      details: [],
      displayStatus: '休息日',
    },
    {
      dayOfWeek: '周日',
      date: '2026-03-29',
      totalHours: 0,
      status: '休息日',
      displayText: '休息日',
      isWeekend: true,
      details: [],
      displayStatus: '休息日',
    },
  ],
  userName: '*REMOVED-PHONE*',
  deptName: '运维服务部',
  reportPeriod: '2026-03-23 - 2026-03-29',
  weekNumber: 13,
  totalHours: 48,
  workDays: 5,
  averageHours: 9.6,
};

const previousWeekReport: WeeklyReportMock = {
  currentWeek: '2026年3月第12周',
  weekRange: '2026-03-16 ~ 2026-03-22',
  monday: '2026-03-16',
  sunday: '2026-03-22',
  days: [
    {
      dayOfWeek: '周一',
      date: '2026-03-16',
      totalHours: 8,
      status: '已达标审批通过',
      displayText: '8h',
      isWeekend: false,
      details: [
        {
          id: 'mock-prev-1',
          period: '全天',
          hours: 8,
          content: '完成周例会与需求拆解，推进任务排期。',
          status: '审批通过',
          statusDesc: '审批通过',
        },
      ],
      displayStatus: '8小时·已达标审批通过',
    },
    {
      dayOfWeek: '周二',
      date: '2026-03-17',
      totalHours: 8,
      status: '已达标审批通过',
      displayText: '8h',
      isWeekend: false,
      details: [
        {
          id: 'mock-prev-2',
          period: '全天',
          hours: 8,
          content: '完成接口联调与错误修复。',
          status: '审批通过',
          statusDesc: '审批通过',
        },
      ],
      displayStatus: '8小时·已达标审批通过',
    },
    {
      dayOfWeek: '周三',
      date: '2026-03-18',
      totalHours: 0,
      status: '未填报',
      displayText: '未填',
      isWeekend: false,
      details: [],
      displayStatus: '未填报',
    },
    {
      dayOfWeek: '周四',
      date: '2026-03-19',
      totalHours: 8,
      status: '已达标审批通过',
      displayText: '8h',
      isWeekend: false,
      details: [
        {
          id: 'mock-prev-4',
          period: '全天',
          hours: 8,
          content: '补充边界测试并完成文档更新。',
          status: '审批通过',
          statusDesc: '审批通过',
        },
      ],
      displayStatus: '8小时·已达标审批通过',
    },
    {
      dayOfWeek: '周五',
      date: '2026-03-20',
      totalHours: 6,
      status: '未达标待补充',
      displayText: '6h',
      isWeekend: false,
      details: [
        {
          id: 'mock-prev-5',
          period: '下午',
          hours: 6,
          content: '推进缺陷修复，剩余工时待补充。',
          status: '待审批',
          statusDesc: '待审批',
        },
      ],
      displayStatus: '6小时·未达标待补充',
    },
    {
      dayOfWeek: '周六',
      date: '2026-03-21',
      totalHours: 0,
      status: '休息日',
      displayText: '休息日',
      isWeekend: true,
      details: [],
      displayStatus: '休息日',
    },
    {
      dayOfWeek: '周日',
      date: '2026-03-22',
      totalHours: 0,
      status: '休息日',
      displayText: '休息日',
      isWeekend: true,
      details: [],
      displayStatus: '休息日',
    },
  ],
  userName: '*REMOVED-PHONE*',
  deptName: '运维服务部',
  reportPeriod: '2026-03-16 - 2026-03-22',
  weekNumber: 12,
  totalHours: 30,
  workDays: 4,
  averageHours: 7.5,
};

const nextWeekReport: WeeklyReportMock = {
  currentWeek: '2026年4月第14周',
  weekRange: '2026-03-30 ~ 2026-04-05',
  monday: '2026-03-30',
  sunday: '2026-04-05',
  days: [
    {
      dayOfWeek: '周一',
      date: '2026-03-30',
      totalHours: 0,
      status: '未填报',
      displayText: '未填',
      isWeekend: false,
      details: [],
      displayStatus: '未填报',
    },
    {
      dayOfWeek: '周二',
      date: '2026-03-31',
      totalHours: 0,
      status: '未填报',
      displayText: '未填',
      isWeekend: false,
      details: [],
      displayStatus: '未填报',
    },
    {
      dayOfWeek: '周三',
      date: '2026-04-01',
      totalHours: 0,
      status: '未填报',
      displayText: '未填',
      isWeekend: false,
      details: [],
      displayStatus: '未填报',
    },
    {
      dayOfWeek: '周四',
      date: '2026-04-02',
      totalHours: 0,
      status: '未填报',
      displayText: '未填',
      isWeekend: false,
      details: [],
      displayStatus: '未填报',
    },
    {
      dayOfWeek: '周五',
      date: '2026-04-03',
      totalHours: 0,
      status: '未填报',
      displayText: '未填',
      isWeekend: false,
      details: [],
      displayStatus: '未填报',
    },
    {
      dayOfWeek: '周六',
      date: '2026-04-04',
      totalHours: 0,
      status: '休息日',
      displayText: '休息日',
      isWeekend: true,
      details: [],
      displayStatus: '休息日',
    },
    {
      dayOfWeek: '周日',
      date: '2026-04-05',
      totalHours: 0,
      status: '休息日',
      displayText: '休息日',
      isWeekend: true,
      details: [],
      displayStatus: '休息日',
    },
  ],
  userName: '*REMOVED-PHONE*',
  deptName: '运维服务部',
  reportPeriod: '2026-03-30 - 2026-04-05',
  weekNumber: 14,
  totalHours: 0,
  workDays: 0,
  averageHours: 0,
};

const weekReports: Record<WeekTab, WeeklyReportMock> = {
  prev: previousWeekReport,
  current: currentWeekReport,
  next: nextWeekReport,
};

export function useWeeklyReportMock() {
  const activeWeek = shallowRef<WeekTab>('current');
  const selectedDate = shallowRef<string | null>(null);

  const report = computed<WeeklyReportMock>(() => weekReports[activeWeek.value]);

  const filledDays = computed(() =>
    report.value.days.filter((day) => !day.isWeekend && day.totalHours > 0).length,
  );

  const unfilledDays = computed(() =>
    report.value.days.filter((day) => !day.isWeekend && day.totalHours <= 0).length,
  );

  const totalDetails = computed(() =>
    report.value.days.reduce((sum, day) => sum + day.details.length, 0),
  );

  const approvedCount = computed(() =>
    report.value.days.reduce(
      (sum, day) => sum + day.details.filter((detail) => detail.status === '审批通过').length,
      0,
    ),
  );

  const pendingCount = computed(() =>
    report.value.days.reduce(
      (sum, day) => sum + day.details.filter((detail) => detail.status === '待审批').length,
      0,
    ),
  );

  const selectedDay = computed<WorkDay | null>(() => {
    if (!selectedDate.value) {
      return null;
    }

    return report.value.days.find((day) => day.date === selectedDate.value) ?? null;
  });

  const selectWeek = (week: WeekTab) => {
    activeWeek.value = week;
    selectedDate.value = null;
  };

  const selectDay = (date: string) => {
    selectedDate.value = date;
  };

  return {
    activeWeek,
    report,
    selectedDate,
    selectedDay,
    filledDays,
    unfilledDays,
    totalDetails,
    approvedCount,
    pendingCount,
    selectWeek,
    selectDay,
  };
}
