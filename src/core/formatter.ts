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

function splitCommentCells(value: string): string[] {
  const cells: string[] = [];
  let index = 0;
  while (index < value.length) {
    while (index < value.length && /\s/.test(value[index])) index++;
    if (index >= value.length) break;
    const start = index;
    if (value[index] === "'") {
      index++;
      while (index < value.length && value[index] !== "'") index++;
      if (index < value.length) index++;
    } else {
      while (index < value.length && !/\s/.test(value[index])) index++;
    }
    cells.push(value.slice(start, index));
  }
  return cells;
}

function followingCommentLines(text: string, header: HeaderRange, moduleEnd: number): Array<{ start: number; cells: string[] }> {
  const comments: Array<{ start: number; cells: string[] }> = [];
  const newline = text.indexOf('\n', header.end);
  if (newline < 0) return comments;
  let lineStart = newline + 1;
  while (lineStart <= moduleEnd) {
    const nextNewline = text.indexOf('\n', lineStart);
    const rawEnd = nextNewline < 0 || nextNewline > moduleEnd ? moduleEnd : nextNewline;
    const lineEnd = rawEnd > lineStart && text[rawEnd - 1] === '\r' ? rawEnd - 1 : rawEnd;
    const line = text.slice(lineStart, lineEnd);
    const match = line.match(/^\s*\/\/\s*(.*)$/);
    if (!match) break;
    comments.push({ start: lineStart, cells: splitCommentCells(match[1]) });
    if (nextNewline < 0 || nextNewline > moduleEnd) break;
    lineStart = nextNewline + 1;
  }
  return comments;
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
    const commentsByHeader = new Map<HeaderRange, Array<{ start: number; cells: string[] }>>();
    for (const line of lines) {
      if (options.isCancelled?.()) return { text, skipped: true, reason: 'cancelled' };
      const cells = 'fields' in line ? line.fields : line.cells;
      cells.forEach((cell, index) => {
        widths[index] = Math.max(widths[index] ?? 0, displayWidth(cell.text, options.tabSize));
      });
    }
    for (const header of module.headers) {
      if (header.marker !== '@' || header.fields.length === 0) continue;
      const comments = followingCommentLines(text, header, module.end).filter((comment) => comment.cells.length === header.fields.length);
      commentsByHeader.set(header, comments);
      for (const comment of comments) {
        comment.cells.forEach((cell, index) => {
          widths[index] = Math.max(widths[index] ?? 0, displayWidth(cell, options.tabSize));
        });
      }
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

    for (const header of module.headers) {
      if (header.marker !== '@' || !selected.includes(header) || header.fields.length === 0) continue;
      const headerLineStart = text.lastIndexOf('\n', header.start - 1) + 1;
      const headerIndent = text.slice(headerLineStart, header.start);
      for (const comment of commentsByHeader.get(header) ?? []) {
        const values = comment.cells.map((cell, index) => pad(cell, widths[index] ?? displayWidth(cell, options.tabSize), options.tabSize, options.insertSpaces));
        replacements.set(comment.start, `${headerIndent}//${values.join(' ').trimEnd()}`);
      }
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
