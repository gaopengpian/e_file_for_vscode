import test from 'node:test';
import assert from 'node:assert/strict';
import { hasEFileContentSignature } from '../core/structure';

test('detects all three E-File markers across consecutive non-comment lines', () => {
  assert.equal(hasEFileContentSignature(['  <bus::Table>', ' // ignored', '\t@ idx name', '# 1 Bus1']), true);
});

test('requires consecutive lines and all three marker types', () => {
  assert.equal(hasEFileContentSignature(['<bus::Table>', 'ordinary text', '@ idx name', '# 1 Bus1']), false);
  assert.equal(hasEFileContentSignature(['<bus::Table>', '@ idx name', '<other::Table>']), false);
});

test('only checks the first 100 lines', () => {
  const lines = [...Array.from({ length: 98 }, () => '// comment'), '<bus::Table>', '@ idx name', '# 1 Bus1'];
  assert.equal(hasEFileContentSignature(lines), false);
});
