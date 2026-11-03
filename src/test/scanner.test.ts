import test from 'node:test';
import assert from 'node:assert/strict';
import { scanDocument, scanFoldingRanges } from '../core/scanner';
import { getHoverContext } from '../core/hover';

const SAMPLE = `<basevalue::MeasurePoint>\n@    name       value        unit\n#    p_base     100.000000   MW\n#    u_scale    1.000000     pu\n</basevalue::MeasurePoint>\n\n<bus::Bus>\n@@   name    voltage    angle\n#    Bus1    230.0      0.0\n</bus::Bus>\n`;

test('scans modules, headers, rows, and cell source ranges', () => {
  const result = scanDocument(SAMPLE);
  assert.equal(result.complete, true);
  assert.equal(result.modules.length, 2);
  assert.equal(result.modules[0].tableName, 'basevalue');
  assert.equal(result.modules[0].headers[0].fields.map((field) => field.text).join(','), 'name,value,unit');
  assert.equal(result.modules[0].rows.length, 2);
  assert.equal(result.modules[0].rows[0].cells[0].text, 'p_base');
  assert.equal(SAMPLE.slice(result.modules[0].rows[0].cells[0].start, result.modules[0].rows[0].cells[0].end), 'p_base');
  assert.equal(result.modules[1].headers[0].fields[2].text, 'angle');
});

test('only treats markers at line start as row markers', () => {
  const result = scanDocument(`<x>\nvalue # inside\n'@ inside string'\n// # inside comment\n# real value\n</x>`);
  assert.equal(result.modules[0].rows.length, 1);
  assert.equal(result.modules[0].rows[0].cells[0].text, 'real');
});

test('scans and folds a large document without a size cutoff', () => {
  const body = Array.from({ length: 12000 }, (_, index) => `# value_${index} 1`).join('\n');
  const text = `<large::Table>\n@ name value\n${body}\n</large::Table>`;
  const result = scanDocument(text, { includeTokens: false });
  const folding = scanFoldingRanges(text);
  assert.equal(result.complete, true);
  assert.equal(result.tokens.length, 0);
  assert.equal(result.modules.length, 1);
  assert.equal(result.modules[0].rows.length, 12000);
  assert.deepEqual(folding, { ranges: [{ startLine: 0, endLine: 12002 }], complete: true });
  assert.equal(result.modules[0].endLine, 12002);
});

test('maps a data cell to its table and header field', () => {
  const result = scanDocument(SAMPLE);
  const valueOffset = SAMPLE.indexOf('100.000000');
  const context = getHoverContext(result, valueOffset);
  assert.deepEqual(context, {
    tableName: 'basevalue',
    tableTag: 'basevalue::MeasurePoint',
    fieldName: 'value',
    value: '100.000000',
    rowNumber: 1
  });
});

test('cancels lightweight folding scan before allocating ranges', () => {
  const result = scanFoldingRanges('<a>\n# value\n</a>', () => true);
  assert.deepEqual(result, { ranges: [], complete: false });
});

test('maps dollar and percent data rows to header fields', () => {
  const result = scanDocument('<flags::Table>\n@ name value\n$ flag enabled\n% ratio 0.5\n</flags::Table>', { includeTokens: false });
  assert.equal(result.modules[0].rows.length, 2);
  assert.equal(result.modules[0].rows[0].marker, '$');
  assert.equal(getHoverContext(result, '<flags::Table>\n@ name value\n$ flag'.length - 1)?.fieldName, 'name');
  assert.equal(result.modules[0].rows[1].marker, '%');
  assert.equal(getHoverContext(result, '<flags::Table>\n@ name value\n$ flag enabled\n% ratio'.length - 1)?.fieldName, 'name');
});

test('parses @# multi-list headers without shifting hover fields', () => {
  const text = '<multi::Table>\n@# 序号 属性名 对象1 对象2\n# 1 A v1 v2\n</multi::Table>';
  const result = scanDocument(text, { includeTokens: false });
  assert.deepEqual(result.modules[0].headers[0].fields.map((field) => field.text), ['序号', '属性名', '对象1', '对象2']);
  const row = result.modules[0].rows[0];
  assert.equal(getHoverContext(result, row.cells[1].start)?.fieldName, '属性名');
  assert.equal(getHoverContext(result, row.cells[3].start)?.fieldName, '对象2');
});

test('keeps the stack on mismatched closing tags', () => {
  const result = scanDocument('<outer::Table>\n<inner::Table>\n# value\n</outer::Table>\n</inner::Table>', { includeTokens: false });
  assert.deepEqual(result.modules.map((module) => module.tableName), ['outer', 'inner']);
  assert.equal(result.modules.find((module) => module.tableName === 'inner')?.rows.length, 1);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.message.includes('Mismatched')));
});
