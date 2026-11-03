import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldScheduleGbkReopen } from '../core/encoding';

test('schedules GBK reopen after E-File language detection for clean UTF-8 documents', () => {
  assert.equal(shouldScheduleGbkReopen('efile', 'utf8', false, false), true);
  assert.equal(shouldScheduleGbkReopen('efile', 'utf8', false, true), false);
  assert.equal(shouldScheduleGbkReopen('efile', 'gbk', false, false), false);
  assert.equal(shouldScheduleGbkReopen('plaintext', 'utf8', false, false), false);
});

test('does not schedule GBK reopen for an in-memory E-File document', () => {
  assert.equal(shouldScheduleGbkReopen('efile', 'utf8', false, false, 'untitled'), false);
});
