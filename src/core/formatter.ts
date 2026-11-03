import { HeaderRange, RowRange } from './model';
import { scanDocument } from './scanner';

export interface FormatOptions {
  tabSize: number;
  insertSpaces: boolean;
  maxBytes: number;
  range?: { start: number; end: number };
  isCancelled?: () => boolean;
}

export interface FormatResult {
  text: string;
  skipped: boolean;
  reason?: 'tooLarge' | 'cancelled';
}

function displayWidth(value: string, tabSize: number): number {
  let width = 0;
  for (const character of value) {
    if (character === '\t') width += tabSize - (width % tabSize);
    else width += /[ᄀ-ᅟ⺀-〾぀-꓏가-힣豈-﫿︐-︙︰-﹯＀-｠￠-￦]/.test(character) ? 2 : 1;
  }
  return width;
}

function pad(value: string, targetWidth: number, tabSize: number, insertSpaces: boolean): string {
  const count = Math.max(0, targetWidth - displayWidth(value, tabSize));
  if (!count) return value;
  if (insertSpaces) return `${value}${' '.repeat(count)}`;
  const tabCount = Math.max(1, Math.ceil(count / tabSize));
  return `${value}${'\t'.repeat(tabCount)}`;
}

export function formatDocument(text: string, options: FormatOptions): FormatResult {
  if (Buffer.byteLength(text, 'utf8') > options.maxBytes) return { text, skipped: true, reason: 'tooLarge' };
  if (options.isCancelled?.()) return { text, skipped: true, reason: 'cancelled' };
  const scan = scanDocument(text, { includeTokens: false, isCancelled: options.isCancelled });
  if (!scan.complete || options.isCancelled?.()) return { text, skipped: true, reason: 'cancelled' };
  const replacements = new Map<number, string>();

  for (const module of scan.modules) {
    const lines: Array<HeaderRange | RowRange> = [...module.headers, ...module.rows];
    const selected = options.range
      ? lines.filter((line) => line.end >= options.range!.start && line.start <= options.range!.end)
      : lines;
    if (selected.length === 0) continue;
    const widths: number[] = [];
    for (const line of lines) {
      if (options.isCancelled?.()) return { text, skipped: true, reason: 'cancelled' };
      const cells = 'fields' in line ? line.fields : line.cells;
      cells.forEach((cell, index) => {
        widths[index] = Math.max(widths[index] ?? 0, displayWidth(cell.text, options.tabSize));
      });
    }
    for (const line of selected) {
      if (options.isCancelled?.()) return { text, skipped: true, reason: 'cancelled' };
      const cells = 'fields' in line ? line.fields : line.cells;
      const values = cells.map((cell, index) => pad(cell.text, widths[index] ?? displayWidth(cell.text, options.tabSize), options.tabSize, options.insertSpaces));
      const marker = line.marker;
      const lineStart = text.lastIndexOf('\n', line.start - 1) + 1;
      const firstCellStart = cells[0]?.start ?? line.end;
      const originalPrefix = text.slice(lineStart, firstCellStart);
      const indent = originalPrefix.match(/^\s*/)?.[0] ?? '';
      const rebuilt = `${indent}${marker}${values.length ? ` ${values.join(' ').trimEnd()}` : ''}`;
      replacements.set(lineStart, rebuilt);
    }
  }

  const output: string[] = [];
  let cursor = 0;
  for (const [start, value] of [...replacements.entries()].sort((left, right) => left[0] - right[0])) {
    if (options.isCancelled?.()) return { text, skipped: true, reason: 'cancelled' };
    const lineEnd = text.indexOf('\n', start);
    if (lineEnd < 0) {
      output.push(text.slice(cursor, start), value);
      cursor = text.length;
    } else {
      const eol = lineEnd > start && text[lineEnd - 1] === '\r' ? '\r\n' : '\n';
      output.push(text.slice(cursor, start), value, eol);
      cursor = lineEnd + 1;
    }
  }
  output.push(text.slice(cursor));
  return { text: output.join(''), skipped: false };
}
