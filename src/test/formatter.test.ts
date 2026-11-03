import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDocument } from '../core/formatter';

test('aligns header and data cells while preserving tags, blank lines, and CRLF', () => {
  const input = '<basevalue::MeasurePoint>\r\n@ name value unit\r\n# p_base 100.000000 MW\r\n\r\n# u_scale 1.000000 pu\r\n</basevalue::MeasurePoint>\r\n';
  const result = formatDocument(input, { tabSize: 4, insertSpaces: true, maxBytes: 1024 });
  assert.equal(result.skipped, false);
  assert.match(result.text, /^<basevalue::MeasurePoint>\r\n/);
  assert.match(result.text, /\r\n\r\n/);
  assert.match(result.text, /<\/basevalue::MeasurePoint>\r\n$/);
  assert.equal(result.text.split('\n').filter((line) => line.includes('p_base'))[0].indexOf('100.000000'), result.text.split('\n').find((line) => line.includes('u_scale'))!.indexOf('1.000000'));
});

test('does not rewrite a tag or a comment and is idempotent', () => {
  const input = "<a::Type>\n// keep # marker\n@ name value\n# 'A B' 1\n</a::Type>\n";
  const once = formatDocument(input, { tabSize: 4, insertSpaces: true, maxBytes: 1024 });
  const twice = formatDocument(once.text, { tabSize: 4, insertSpaces: true, maxBytes: 1024 });
  assert.equal(once.text.split('\n')[0], '<a::Type>');
  assert.equal(once.text.split('\n')[1], '// keep # marker');
  assert.equal(once.text, twice.text);
});

test('skips oversized content without changing it', () => {
  const input = '<a>\n# value\n</a>';
  const result = formatDocument(input, { tabSize: 4, insertSpaces: true, maxBytes: input.length - 1 });
  assert.deepEqual(result, { text: input, skipped: true, reason: 'tooLarge' });
});

test('range formatting changes only selected data lines', () => {
  const input = '<one::Type>\n@ name value\n# a 1\n# longer 200\n</one::Type>\n<two::Type>\n@ code amount\n# z 9000\n</two::Type>\n';
  const selectedStart = input.indexOf('# a 1');
  const selectedEnd = selectedStart + '# a 1'.length;
  const result = formatDocument(input, { tabSize: 4, insertSpaces: true, maxBytes: 1024, range: { start: selectedStart, end: selectedEnd } });
  assert.equal(result.text, input.replace('# a 1', '# a      1'));
});

test('uses tabs for padding when insertSpaces is disabled', () => {
  const input = '<a::Type>\n@ name value\n# x 1234\n</a::Type>\n';
  const result = formatDocument(input, { tabSize: 4, insertSpaces: false, maxBytes: 1024 });
  assert.equal(result.text, '<a::Type>\n@ name value\n# x\t 1234\n</a::Type>\n');
});

test('returns unchanged content when formatting is cancelled', () => {
  const input = '<a::Type>\n@ name value\n# x 1234\n</a::Type>\n';
  const result = formatDocument(input, { tabSize: 4, insertSpaces: true, maxBytes: 1024, isCancelled: () => true });
  assert.deepEqual(result, { text: input, skipped: true, reason: 'cancelled' });
});

test('formats many rows with stable ordering', () => {
  const rows = Array.from({ length: 5000 }, (_, index) => `# x${index} ${index}`).join('\n');
  const input = `<a::Type>\n@ name value\n${rows}\n</a::Type>\n`;
  const result = formatDocument(input, { tabSize: 4, insertSpaces: true, maxBytes: 1024 * 1024 });
  assert.equal(result.skipped, false);
  assert.ok(result.text.includes('# x0    0'));
  assert.ok(result.text.includes('# x4999 4999'));
  assert.ok(result.text.indexOf('# x0') < result.text.indexOf('# x4999'));
});
