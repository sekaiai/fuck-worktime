import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateRemainingHours } from '../week-fill-hours.ts';

test('按已提交工时计算首次新增行的剩余工时', () => {
  assert.equal(calculateRemainingHours(3, 0), 5);
});

test('继续新增时扣除当前页面已有的新草稿', () => {
  assert.equal(calculateRemainingHours(3, 2), 3);
});

test('已达到或超过八小时后剩余工时为零', () => {
  assert.equal(calculateRemainingHours(8, 0), 0);
  assert.equal(calculateRemainingHours(10, 2), 0);
});
