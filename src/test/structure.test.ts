import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStructureIndex } from '../core/structureIndex';
import { scanDocument } from '../core/scanner';

test('builds one direct tree row per header field under each table', () => {
  const text = '<node::Table>\n@ idx name realbs\n# 1 Bus1 1\n</node::Table>';
  const index = buildStructureIndex(scanDocument(text, { includeTokens: false }));
  assert.equal(index.length, 1);
  assert.equal(index[0].label, 'node [1]');
  assert.deepEqual(index[0].children.map((field) => field.label), ['idx', 'name', 'realbs']);
  assert.ok(index[0].children.every((field) => field.children.length === 0));
  assert.deepEqual(index[0].children.map((field) => field.parentKey), ['0', '0', '0']);
});
