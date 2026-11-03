import test from 'node:test';
import assert from 'node:assert/strict';
import { scanDocument } from '../core/scanner';
import { findStructureTarget, getFieldNavigationOffset } from '../core/structureNavigation';

const TEXT = '<one::Type>\n@ idx name value\n# 1 Bus1 230\n# 2 Bus2 220\n</one::Type>\n<two::Type>\n@ idx code\n# 1 A\n</two::Type>';

test('maps a data cell caret to the matching table field', () => {
  const scan = scanDocument(TEXT, { includeTokens: false });
  const offset = TEXT.indexOf('Bus1') + 1;
  assert.deepEqual(findStructureTarget(scan, offset), { moduleIndex: 0, headerIndex: 0, fieldIndex: 1 });
});

test('maps a header caret to its field and tag caret to its table', () => {
  const scan = scanDocument(TEXT, { includeTokens: false });
  assert.deepEqual(findStructureTarget(scan, TEXT.indexOf('value') + 1), { moduleIndex: 0, headerIndex: 0, fieldIndex: 2 });
  assert.deepEqual(findStructureTarget(scan, TEXT.indexOf('<one')), { moduleIndex: 0 });
  assert.equal(findStructureTarget(scan, TEXT.indexOf('outside')), undefined);
});

test('navigates within current data row when caret is already in target table', () => {
  const scan = scanDocument(TEXT, { includeTokens: false });
  const module = scan.modules[0];
  const current = TEXT.indexOf('Bus1') + 1;
  assert.equal(getFieldNavigationOffset(TEXT, module, 0, 2, current), TEXT.indexOf('230'));
});

test('navigates to target header field from another table', () => {
  const scan = scanDocument(TEXT, { includeTokens: false });
  const module = scan.modules[0];
  assert.equal(getFieldNavigationOffset(TEXT, module, 0, 2, TEXT.indexOf('A')), TEXT.indexOf('value'));
});
