import test from 'node:test';
import assert from 'node:assert/strict';
import { getCachedScan } from '../core/scanCache';

test('reuses one scan for the same document version and rescans after edits', () => {
  const document = {};
  const first = getCachedScan(document, 1, '<a>\n# x 1\n</a>');
  const reused = getCachedScan(document, 1, '<a>\n# x 1\n</a>');
  const updated = getCachedScan(document, 2, '<a>\n# x 2\n</a>');
  assert.equal(reused, first);
  assert.notEqual(updated, first);
  assert.equal(updated.modules[0].rows[0].cells[1].text, '2');
});

test('does not cache cancelled scans and retries on next request', () => {
  const document = {};
  const text = '<a>\n# x 1\n</a>';
  const cancelled = getCachedScan(document, 1, text, { isCancelled: () => true });
  assert.equal(cancelled.complete, false);
  const retried = getCachedScan(document, 1, text, { isCancelled: () => false });
  assert.equal(retried.complete, true);
  assert.equal(retried.modules[0].rows[0].cells[1].text, '1');
});

test('keeps hover and structure scan available above the rainbow analysis limit', () => {
  const document = {};
  const value = 'x'.repeat(1024 * 1024 + 1);
  const text = `<large::Table>\n@ field\n# ${value}\n</large::Table>`;
  const result = getCachedScan(document, 1, text);
  assert.equal(result.complete, true);
  assert.equal(result.modules.length, 1);
  assert.equal(result.modules[0].rows[0].cells[0].text.length, value.length);
});
