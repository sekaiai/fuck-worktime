import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapDayStatus } from '../timesheet-status.ts';

function day(overrides = {}) {
  return { date: '2026-07-20', isWeekend: false, status: '未提交', displayStatus: '', ...overrides };
}

test('休息日：isWeekend 优先', () => {
  const r = mapDayStatus(day({ isWeekend: true }));
  assert.equal(r.key, 'rest');
  assert.equal(r.label, '休息日');
});

test('未填报：status 未提交且 date <= 今天', () => {
  const r = mapDayStatus(day({ date: '2026-07-31', status: '未提交' }));
  assert.equal(r.key, 'none');
  assert.equal(r.label, '未填报');
});

test('待审核：displayStatus 含待审核', () => {
  const r = mapDayStatus(day({ displayStatus: '待审核' }));
  assert.equal(r.key, 'pending');
});

test('已审核：displayStatus 含通过/已审核/已完成', () => {
  assert.equal(mapDayStatus(day({ displayStatus: '已通过' })).key, 'approved');
  assert.equal(mapDayStatus(day({ displayStatus: '已审核' })).key, 'approved');
});

test('审核失败：displayStatus 含不通过/失败/驳回', () => {
  assert.equal(mapDayStatus(day({ displayStatus: '不通过' })).key, 'rejected');
  assert.equal(mapDayStatus(day({ displayStatus: '审核失败' })).key, 'rejected');
});

test('未来日：status 未提交且 date > 今天，无标点', () => {
  const r = mapDayStatus(day({ date: '2026-08-05', status: '未提交' }));
  assert.equal(r.key, 'future');
  assert.equal(r.color, 'transparent');
});

test('未知 displayStatus 回退未填报，不抛错', () => {
  const r = mapDayStatus(day({ displayStatus: '未知状态XYZ' }));
  assert.equal(r.key, 'none');
});
