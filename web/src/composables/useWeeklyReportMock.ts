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

const DAY_OF_WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

const currentWeekTemplate: WeeklyReportMock = {
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

const pad = (value: number) => String(value).padStart(2, '0');

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0, 0);

const formatIsoDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const getWeekStart = (date: Date) => {
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(date, offset);
};

const getIsoWeekNumber = (date: Date) => {
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  const day = normalized.getDay() || 7;
  normalized.setDate(normalized.getDate() + 4 - day);
  const yearStart = new Date(normalized.getFullYear(), 0, 1, 12, 0, 0, 0);

  return Math.ceil((((normalized.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7);
};

const createFutureDay = (date: string, dayOfWeek: string, isWeekend: boolean): WorkDay => {
  if (isWeekend) {
    return {
      dayOfWeek,
      date,
      totalHours: 0,
      status: '休息日',
      displayText: '休息日',
      isWeekend: true,
      details: [],
      displayStatus: '休息日',
    };
  }

  return {
    dayOfWeek,
    date,
    totalHours: 0,
    status: '未填报',
    displayText: '未填',
    isWeekend: false,
    details: [],
    displayStatus: '未填报',
  };
};

const cloneDetails = (details: readonly WorkDetail[], date: string) =>
  details.map((detail, index) => ({
    ...detail,
    id: `${detail.id}-${date}-${index}`,
  }));

const actualCurrentWeekStart = getWeekStart(new Date());

const buildWeekReport = (weekOffset: number): WeeklyReportMock => {
  const targetMonday = addDays(actualCurrentWeekStart, weekOffset * 7);
  const days = currentWeekTemplate.days.map((templateDay, index) => {
    const targetDate = formatIsoDate(addDays(targetMonday, index));
    const dayOfWeek = DAY_OF_WEEK_LABELS[index];

    if (weekOffset > 0) {
      return createFutureDay(targetDate, dayOfWeek, templateDay.isWeekend);
    }

    return {
      ...templateDay,
      dayOfWeek,
      date: targetDate,
      details: cloneDetails(templateDay.details, targetDate),
    };
  });

  const totalHours = days.reduce((sum, day) => sum + day.totalHours, 0);
  const workDays = days.filter((day) => !day.isWeekend && day.totalHours > 0).length;
  const averageHours = workDays > 0 ? Number((totalHours / workDays).toFixed(1)) : 0;
  const sunday = addDays(targetMonday, 6);
  const weekNumber = getIsoWeekNumber(targetMonday);
  const displayMonth = targetMonday.getMonth() + 1;
  const monday = formatIsoDate(targetMonday);
  const sundayText = formatIsoDate(sunday);

  return {
    currentWeek: `${targetMonday.getFullYear()}年${displayMonth}月第${weekNumber}周`,
    weekRange: `${monday} ~ ${sundayText}`,
    monday,
    sunday: sundayText,
    days,
    userName: currentWeekTemplate.userName,
    deptName: currentWeekTemplate.deptName,
    reportPeriod: `${monday} - ${sundayText}`,
    weekNumber,
    totalHours,
    workDays,
    averageHours,
  };
};

export function useWeeklyReportMock() {
  const weekOffset = shallowRef(0);
  const selectedDate = shallowRef<string | null>(null);

  const activeWeek = computed<WeekTab>(() => {
    if (weekOffset.value < 0) {
      return 'prev';
    }

    if (weekOffset.value > 0) {
      return 'next';
    }

    return 'current';
  });

  const report = computed<WeeklyReportMock>(() => buildWeekReport(weekOffset.value));

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
    if (week === 'current') {
      weekOffset.value = 0;
    } else if (week === 'prev') {
      weekOffset.value -= 1;
    } else {
      weekOffset.value += 1;
    }

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
