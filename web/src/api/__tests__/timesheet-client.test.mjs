import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { build } from 'esbuild';

const bundle = await build({
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  define: {
    'import.meta.env.PROD': 'false',
  },
  stdin: {
    contents: `
      export {
        getReportFlowButtons,
        getReportFlowTask,
        handleReportFlow,
        deleteEntry,
        submitBatch,
      } from './web/src/api/timesheet-client.ts';
      export { useWeekFill } from './web/src/composables/useWeekFill.ts';
      export { clearAuthToken, setAuthToken } from './web/src/api/request.ts';
      export { ref } from 'vue';
    `,
    resolveDir: new URL('../../../..', import.meta.url).pathname,
    sourcefile: 'timesheet-client-test-entry.ts',
    loader: 'ts',
  },
});

const client = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`,
);
const originalFetch = globalThis.fetch;
const originalLocalStorage = globalThis.localStorage;

afterEach(() => {
  globalThis.fetch = originalFetch;
  client.clearAuthToken();
  if (originalLocalStorage === undefined) {
    delete globalThis.localStorage;
  } else {
    globalThis.localStorage = originalLocalStorage;
  }
});

test('submitBatch 直连上游并透传成功响应', async () => {
  const body = {
    workingTimingList: [
      {
        reportDate: '2026-09-02',
        projectId: 'project-1',
        projectTitle: '测试项目',
        projectStatus: 30,
        itemId: 'item-1',
        content: '测试内容',
        hours: 1,
      },
    ],
  };
  let request;

  globalThis.fetch = async (input, init) => {
    request = { input: String(input), init };
    return new Response(
      JSON.stringify({ code: 200, msg: '任务已创建，等待执行', data: { taskId: 'task-1' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };
  client.setAuthToken('frontend-test-token');

  const result = await client.submitBatch(body);

  assert.equal(
    request.input,
    'https://times.gzbdgc.com.cn:8099/prod-api/working/timing/reportBatch',
  );
  assert.equal(request.init.method, 'POST');
  assert.deepEqual(JSON.parse(request.init.body), body);
  assert.equal(new Headers(request.init.headers).get('Authorization'), 'Bearer frontend-test-token');
  assert.deepEqual(result, {
    code: 200,
    msg: '任务已创建，等待执行',
    data: { taskId: 'task-1' },
  });
});

test('submitBatch 不吞掉上游业务失败的 code、message 和 data', async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ code: 500, message: '上游校验失败', data: { field: 'hours' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  client.setAuthToken('frontend-test-token');

  const result = await client.submitBatch({ workingTimingList: [] });

  assert.deepEqual(result, {
    code: 500,
    msg: '上游校验失败',
    data: { field: 'hours' },
  });
});

test('deleteEntry 按上游接口使用 POST 删除并携带凭据', async () => {
  let request;
  globalThis.fetch = async (input, init) => {
    request = { input: String(input), init };
    return new Response(JSON.stringify({ code: 200, msg: '删除成功', data: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  client.setAuthToken('frontend-test-token');

  const result = await client.deleteEntry('detail/1');

  assert.equal(
    request.input,
    'https://times.gzbdgc.com.cn:8099/prod-api/working/timing/delete/detail%2F1',
  );
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.body, null);
  assert.equal(request.init.credentials, 'include');
  assert.equal(new Headers(request.init.headers).get('Authorization'), 'Bearer frontend-test-token');
  assert.deepEqual(result, { code: 200, msg: '删除成功', data: null });
});

test('审核失败重新提交按 flow、buttons、handle 顺序透传参数', async () => {
  const entry = {
    reportDate: '2026-09-01',
    projectId: 'project-1',
    projectTitle: '测试项目',
    projectStatus: 30,
    itemId: 'item-1',
    hours: 8,
    content: '测试重新提交',
  };
  const requests = [];
  const responses = [
    { code: 200, msg: '操作成功', data: 'task-1' },
    {
      code: 200,
      msg: '操作成功',
      data: [{ key: 'timing-audit-btn-report', name: '提交上报' }],
    },
    { code: 200, msg: '上报成功', data: { id: 'result-1' } },
  ];

  globalThis.fetch = async (input, init) => {
    requests.push({ input: String(input), init });
    return new Response(JSON.stringify(responses[requests.length - 1]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  client.setAuthToken('frontend-test-token');

  const flow = await client.getReportFlowTask('detail/1');
  const buttons = await client.getReportFlowButtons(flow.taskId);
  const handle = await client.handleReportFlow(flow.taskId, buttons.buttonKey, entry);

  assert.deepEqual(
    requests.map((request) => [request.input, request.init.method]),
    [
      ['https://times.gzbdgc.com.cn:8099/prod-api/working-timing/flow/detail%2F1', 'GET'],
      ['https://times.gzbdgc.com.cn:8099/prod-api/working-timing/flow/buttons?taskId=task-1', 'GET'],
      ['https://times.gzbdgc.com.cn:8099/prod-api/working-timing/flow/handle', 'POST'],
    ],
  );
  for (const request of requests) {
    assert.equal(new Headers(request.init.headers).get('Authorization'), 'Bearer frontend-test-token');
  }
  assert.equal(requests[2].init.credentials, 'include');
  assert.equal(new Headers(requests[2].init.headers).get('Content-Type'), 'application/json;charset=UTF-8');
  assert.deepEqual(JSON.parse(requests[2].init.body), {
    taskId: 'task-1',
    submitInfo: {
      buttonKey: 'timing-audit-btn-report',
      decision: 1,
      opinion: '',
      data: {
        form: entry,
      },
    },
  });
  assert.deepEqual(flow, { code: 200, msg: '操作成功', data: 'task-1', taskId: 'task-1' });
  assert.equal(buttons.buttonKey, 'timing-audit-btn-report');
  assert.deepEqual(handle, { code: 200, msg: '上报成功', data: { id: 'result-1' } });
});

test('flow 业务失败时保留上游响应，调用方可跳过后续按钮请求', async () => {
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return new Response(
      JSON.stringify({ code: 500, msg: '不能重新提交', data: { state: 'closed' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };
  client.setAuthToken('frontend-test-token');

  const result = await client.getReportFlowTask('detail-1');

  assert.deepEqual(result, {
    code: 500,
    msg: '不能重新提交',
    data: { state: 'closed' },
    taskId: null,
  });
  assert.equal(requestCount, 1);
});

test('useWeekFill 部分成功时只移除成功的旧记录', async () => {
  const rows = [
    {
      rowId: 'row-success',
      reportDate: '2026-09-01',
      sourceId: 'detail-success',
      projectId: 'project-1',
      projectTitle: '测试项目',
      projectStatus: 30,
      itemId: 'item-1',
      itemName: '测试类型',
      hours: 8,
      content: '成功记录',
    },
    {
      rowId: 'row-failed',
      reportDate: '2026-09-02',
      sourceId: 'detail-failed',
      projectId: 'project-1',
      projectTitle: '测试项目',
      projectStatus: 30,
      itemId: 'item-1',
      itemName: '测试类型',
      hours: 8,
      content: '失败记录',
    },
  ];
  const responses = [
    { code: 200, msg: '操作成功', data: 'task-success' },
    { code: 200, msg: '操作成功', data: [{ key: 'timing-audit-btn-report' }] },
    { code: 200, msg: '操作成功', data: 'task-failed' },
    { code: 200, msg: '操作成功', data: [{ key: 'timing-audit-btn-report' }] },
    { code: 200, msg: '重新提交成功', data: { id: 'result-success' } },
    { code: 500, msg: '重新提交失败', data: { reason: '校验失败' } },
  ];
  let requestCount = 0;
  let refreshCount = 0;
  const events = [];

  globalThis.fetch = async () =>
    new Response(JSON.stringify(responses[requestCount++]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  client.setAuthToken('frontend-test-token');

  const weekFill = client.useWeekFill({
    days: () => [],
    projects: () => [],
    getWorkTypesForProject: () => [],
    loadWorkTypesByProject: async () => [],
    getAutoFillConfig: () => null,
    refreshWeekBoard: async () => {
      refreshCount += 1;
      events.push('refresh');
    },
    showToast: () => {
      events.push('message');
    },
  });
  weekFill.draftRows.value = rows;

  const result = await weekFill.submitAll();

  assert.equal(requestCount, 6);
  assert.deepEqual(weekFill.draftRows.value.map((row) => row.rowId), ['row-failed']);
  assert.equal(refreshCount, 1);
  assert.deepEqual(events, ['message', 'refresh']);
  assert.deepEqual(result.items.map((item) => [item.rowId, item.success]), [
    ['row-success', true],
    ['row-failed', false],
  ]);
  assert.deepEqual(result.items[1].steps.at(-1), {
    name: 'handle',
    code: 500,
    msg: '重新提交失败',
    data: { reason: '校验失败' },
  });
});

test('每行可单独通过 flow 重新提交', async () => {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  };
  const responses = [
    { code: 200, msg: '操作成功', data: 'task-one' },
    { code: 200, msg: '操作成功', data: [{ key: 'timing-audit-btn-report' }] },
    { code: 200, msg: '重新提交成功', data: { id: 'result-one' } },
  ];
  let requestCount = 0;
  let refreshCount = 0;
  globalThis.fetch = async () =>
    new Response(JSON.stringify(responses[requestCount++]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  client.setAuthToken('frontend-test-token');

  const weekFill = client.useWeekFill({
    days: () => [],
    projects: () => [],
    getWorkTypesForProject: () => [],
    loadWorkTypesByProject: async () => [],
    getAutoFillConfig: () => null,
    refreshWeekBoard: async () => {
      refreshCount += 1;
    },
    showToast: () => {},
  });
  weekFill.draftRows.value = [{
    rowId: 'row-one',
    reportDate: '2026-09-01',
    sourceId: 'detail-one',
    projectId: 'project-1',
    projectTitle: '测试项目',
    projectStatus: 30,
    itemId: 'item-1',
    itemName: '测试类型',
    hours: 8,
    content: '单独提交记录',
  }];

  const result = await weekFill.submitRow('row-one');

  assert.equal(requestCount, 3);
  assert.equal(refreshCount, 1);
  assert.deepEqual(weekFill.draftRows.value, []);
  assert.equal(weekFill.submittingRowIds.value.length, 0);
  assert.deepEqual(result.items.map((item) => [item.rowId, item.mode, item.success]), [
    ['row-one', 'flow', true],
  ]);
});

test('新建行可单独调用 reportBatch 提交', async () => {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  };
  let request;
  globalThis.fetch = async (input, init) => {
    request = { input: String(input), init };
    return new Response(JSON.stringify({ code: 200, msg: '任务已创建，等待执行', data: { taskId: 'task-new' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  client.setAuthToken('frontend-test-token');

  const weekFill = client.useWeekFill({
    days: () => [],
    projects: () => [],
    getWorkTypesForProject: () => [],
    loadWorkTypesByProject: async () => [],
    getAutoFillConfig: () => null,
    refreshWeekBoard: async () => {},
    showToast: () => {},
  });
  weekFill.draftRows.value = [{
    rowId: 'row-new',
    reportDate: '2026-09-02',
    sourceId: null,
    projectId: 'project-1',
    projectTitle: '测试项目',
    projectStatus: 30,
    itemId: 'item-1',
    itemName: '测试类型',
    hours: 1,
    content: '单独新建记录',
  }];

  const result = await weekFill.submitRow('row-new');

  assert.equal(request.input, 'https://times.gzbdgc.com.cn:8099/prod-api/working/timing/reportBatch');
  assert.equal(request.init.method, 'POST');
  assert.equal(result.items[0].mode, 'reportBatch');
  assert.equal(result.items[0].success, true);
});

test('单日工时超过八小时输入时自动回退到剩余工时', () => {
  const weekFill = client.useWeekFill({
    days: () => [{
      date: '2026-09-02',
      dayOfWeek: '周三',
      isWeekend: false,
      status: '未提交',
      displayText: '未提交',
      displayStatus: '未提交',
      totalHours: 0,
      details: [],
    }],
    projects: () => [],
    getWorkTypesForProject: () => [],
    loadWorkTypesByProject: async () => [],
    getAutoFillConfig: () => null,
    refreshWeekBoard: async () => {},
    showToast: () => {},
  });
  weekFill.draftRows.value = [
    {
      rowId: 'row-seven',
      reportDate: '2026-09-02',
      sourceId: null,
      projectId: 'project-1',
      projectTitle: '测试项目',
      projectStatus: 30,
      itemId: 'item-1',
      itemName: '测试类型',
      hours: 7,
      content: '第一条',
    },
    {
      rowId: 'row-half',
      reportDate: '2026-09-02',
      sourceId: null,
      projectId: 'project-1',
      projectTitle: '测试项目',
      projectStatus: 30,
      itemId: 'item-1',
      itemName: '测试类型',
      hours: 0.5,
      content: '第二条',
    },
  ];

  weekFill.addRow('2026-09-02');
  const thirdRow = weekFill.draftRows.value.at(-1);
  assert.equal(thirdRow?.hours, 0.5);

  if (!thirdRow) {
    return;
  }
  weekFill.setRowHours(thirdRow.rowId, 1);
  assert.equal(weekFill.draftRows.value.at(-1)?.hours, 0.5);
});

test('周看板同步全部明细并在撤回后保留可编辑记录和新草稿', async () => {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  };

  const pendingDetail = {
    id: 'detail-pending',
    period: '全天',
    hours: 8,
    content: '待审批原始内容',
    status: '待审批',
    statusDesc: '待审批',
  };
  const rejectedDetail = {
    id: 'detail-rejected',
    period: '上午',
    hours: 4,
    content: '上游驳回内容',
    status: '审核失败',
    statusDesc: '驳回',
  };
  const day = (date, status, displayStatus, details) => ({
    date,
    dayOfWeek: '周一',
    isWeekend: false,
    status,
    displayText: displayStatus,
    displayStatus,
    totalHours: details.reduce((sum, detail) => sum + detail.hours, 0),
    details,
  });
  const boardDays = client.ref([
    day('2026-09-01', '已达标待审批', '8小时·已达标待审批', [pendingDetail]),
    day('2026-09-02', '审核失败', '审核失败', [rejectedDetail]),
  ]);
  const weekFill = client.useWeekFill({
    days: () => boardDays.value,
    projects: () => [],
    getWorkTypesForProject: () => [],
    loadWorkTypesByProject: async () => [],
    getAutoFillConfig: () => null,
    refreshWeekBoard: async () => {},
    showToast: () => {},
  });
  const newDraft = {
    rowId: 'row-new-draft',
    reportDate: '2026-09-03',
    sourceId: null,
    projectId: 'project-1',
    projectTitle: '新草稿项目',
    projectStatus: 30,
    itemId: 'item-1',
    itemName: '新草稿类型',
    hours: 2,
    content: '未提交新草稿',
  };
  weekFill.draftRows.value = [
    {
      rowId: 'row-rejected',
      reportDate: '2026-09-02',
      sourceId: 'detail-rejected',
      projectId: 'project-1',
      projectTitle: '用户选择项目',
      projectStatus: 30,
      itemId: 'item-1',
      itemName: '用户选择类型',
      hours: 3,
      content: '用户已经编辑的内容',
    },
    newDraft,
  ];

  await weekFill.initializeWeek();

  assert.deepEqual(weekFill.draftRows.value.map((row) => row.rowId), [
    'row-rejected',
    'row-new-draft',
  ]);
  assert.equal(weekFill.draftRows.value[0].sourceId, 'detail-rejected');
  assert.equal(weekFill.draftRows.value[0].content, '用户已经编辑的内容');
  assert.equal(weekFill.draftRows.value.some((row) => row.sourceId === 'detail-pending'), false);

  boardDays.value = [
    day('2026-09-01', '已撤回', '已撤回', [{
      ...pendingDetail,
      status: '已撤回',
      statusDesc: '已撤回',
    }]),
    day('2026-09-02', '审核失败', '审核失败', [rejectedDetail]),
  ];
  await weekFill.initializeWeek();

  assert.equal(weekFill.draftRows.value.length, 3);
  const revokedRow = weekFill.draftRows.value.find((row) => row.sourceId === 'detail-pending');
  assert.ok(revokedRow);
  assert.equal(revokedRow.content, '待审批原始内容');
  assert.equal(weekFill.draftRows.value.find((row) => row.rowId === 'row-rejected').content, '用户已经编辑的内容');
  assert.equal(weekFill.draftRows.value.some((row) => row.rowId === 'row-new-draft'), true);
});
