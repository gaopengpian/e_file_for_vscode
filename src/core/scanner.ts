import { CellRange, HeaderRange, HoverContext, ModuleRange, RowRange, ScanResult, Token, TokenKind } from './model';

export interface ScanOptions {
  isCancelled?: () => boolean;
  includeTokens?: boolean;
}

function splitCells(text: string, from: number, to: number): CellRange[] {
  const cells: CellRange[] = [];
  let index = from;
  while (index < to) {
    while (index < to && (text[index] === ' ' || text[index] === '\t' || text[index] === '\r')) index++;
    if (index >= to || text[index] === '\n') break;
    const start = index;
    if (text[index] === '\'') {
      index++;
      while (index < to && text[index] !== '\'') index++;
      if (index < to) index++;
    } else {
      while (index < to && text[index] !== ' ' && text[index] !== '\t' && text[index] !== '\r' && text[index] !== '\n') index++;
    }
    cells.push({ text: text.slice(start, index), start, end: index, columnIndex: cells.length });
  }
  return cells;
}

function token(text: string, kind: TokenKind, start: number, end: number, line: number, lineStart: number): Token {
  return { kind, start, end, line, column: start - lineStart, text: text.slice(start, end) };
}

function scanTokens(text: string, isCancelled?: () => boolean): { tokens: Token[]; complete: boolean } {
  const tokens: Token[] = [];
  let index = 0;
  let line = 0;
  let lineStart = 0;
  let atLineStart = true;
  let inTag = false;

  const advanceWhitespace = (): void => {
    while (index < text.length && /\s/.test(text[index])) {
      if (text[index] === '\n') {
        line++;
        lineStart = index + 1;
        atLineStart = true;
      }
      index++;
    }
  };

  while (index < text.length) {
    if (isCancelled?.()) return { tokens, complete: false };
    const start = index;
    const tokenLine = line;
    const tokenLineStart = lineStart;
    const character = text[index];

    if (/\s/.test(character)) {
      advanceWhitespace();
      tokens.push(token(text, 'whitespace', start, index, tokenLine, tokenLineStart));
      continue;
    }

    if (character === '/' && text[index + 1] === '/' && atLineStart) {
      index += 2;
      while (index < text.length && text[index] !== '\n') index++;
      tokens.push(token(text, 'comment', start, index, tokenLine, tokenLineStart));
      atLineStart = false;
      continue;
    }

    if (character === '<') {
      if (text[index + 1] === '/') {
        index += 2;
        tokens.push(token(text, 'tagCloseStart', start, index, tokenLine, tokenLineStart));
      } else if (text[index + 1] === '!') {
        index += 2;
        tokens.push(token(text, 'tagInfoStart', start, index, tokenLine, tokenLineStart));
      } else {
        index++;
        tokens.push(token(text, 'tagStart', start, index, tokenLine, tokenLineStart));
      }
      inTag = true;
      atLineStart = false;
      continue;
    }

    if (character === '>') {
      index++;
      tokens.push(token(text, 'tagEnd', start, index, tokenLine, tokenLineStart));
      inTag = false;
      atLineStart = false;
      continue;
    }

    if (character === '!' && text[index + 1] === '>') {
      index += 2;
      tokens.push(token(text, 'tagInfoEnd', start, index, tokenLine, tokenLineStart));
      inTag = false;
      atLineStart = false;
      continue;
    }

    if (character === '\'') {
      index++;
      while (index < text.length && text[index] !== '\'') {
        if (text[index] === '\n') {
          line++;
          lineStart = index + 1;
        }
        index++;
      }
      if (index < text.length) index++;
      tokens.push(token(text, 'string', start, index, tokenLine, tokenLineStart));
      atLineStart = false;
      continue;
    }

    if (atLineStart && (character === '@' || character === '#' || character === '$' || character === '%')) {
      if (character === '@' && text[index + 1] === '@') {
        index += 2;
        tokens.push(token(text, 'markerAtAt', start, index, tokenLine, tokenLineStart));
      } else {
        index++;
        const markerKind: TokenKind = character === '@' ? 'markerAt' : character === '#' ? 'markerHash' : character === '$' ? 'markerDollar' : 'markerPercent';
        tokens.push(token(text, markerKind, start, index, tokenLine, tokenLineStart));
      }
      atLineStart = false;
      continue;
    }

    if (character === ':' && text[index + 1] === ':') {
      index += 2;
      tokens.push(token(text, inTag ? 'tagIdentifier' : 'doubleColon', start, index, tokenLine, tokenLineStart));
      atLineStart = false;
      continue;
    }

    index++;
    while (index < text.length && !/\s/.test(text[index]) && !['<', '>', "'"].includes(text[index])) index++;
    tokens.push(token(text, inTag ? 'tagIdentifier' : 'identifier', start, index, tokenLine, tokenLineStart));
    atLineStart = false;
  }
  return { tokens, complete: true };
}

function parseModuleTag(line: string): { closing: boolean; tag: string; tableName: string; tagOffset: number } | undefined {
  const trimmed = line.trimStart();
  if (!trimmed.startsWith('<') || trimmed.startsWith('<!')) return undefined;
  const end = trimmed.indexOf('>');
  if (end < 0) return undefined;
  const closing = trimmed.startsWith('</');
  const contentStart = closing ? 2 : 1;
  const content = trimmed.slice(contentStart, end).replace(/!$/, '').trim();
  if (!content) return undefined;
  return {
    closing,
    tag: content,
    tableName: content.split('::', 1)[0].trim(),
    tagOffset: line.length - trimmed.length
  };
}

function lineEndAt(text: string, lineStart: number): number {
  const newline = text.indexOf('\n', lineStart);
  const rawEnd = newline < 0 ? text.length : newline;
  return rawEnd > lineStart && text[rawEnd - 1] === '\r' ? rawEnd - 1 : rawEnd;
}

export function scanDocument(text: string, options: ScanOptions = {}): ScanResult {
  const tokenResult = options.includeTokens === false ? { tokens: [], complete: true } : scanTokens(text, options.isCancelled);
  if (!tokenResult.complete) return { tokens: tokenResult.tokens, modules: [], diagnostics: [], complete: false };

  const modules: ModuleRange[] = [];
  const diagnostics: ScanResult['diagnostics'] = [];
  const stack: ModuleRange[] = [];
  let lineStart = 0;
  let lineNumber = 0;

  while (lineStart <= text.length) {
    if (options.isCancelled?.()) return { tokens: tokenResult.tokens, modules: [], diagnostics: [], complete: false };
    const lineEnd = lineEndAt(text, lineStart);
    const newline = text.indexOf('\n', lineStart);
    const line = text.slice(lineStart, lineEnd);
    const trimmed = line.trimStart();
    const parsedTag = parseModuleTag(line);

    if (parsedTag && !parsedTag.closing) {
      const module: ModuleRange = {
        tableName: parsedTag.tableName,
        tableTag: parsedTag.tag,
        start: lineStart + parsedTag.tagOffset,
        end: lineEnd,
        startLine: lineNumber,
        endLine: lineNumber,
        headers: [],
        rows: []
      };
      stack.push(module);
    } else if (parsedTag?.closing) {
      const current = stack[stack.length - 1];
      if (!current) {
        diagnostics.push({ message: `Unmatched closing tag: ${parsedTag.tag}`, offset: lineStart, severity: 'warning' });
      } else if (current.tableTag !== parsedTag.tag) {
        diagnostics.push({ message: `Mismatched closing tag: expected ${current.tableTag}, got ${parsedTag.tag}`, offset: lineStart, severity: 'warning' });
      } else {
        stack.pop();
        current.end = lineEnd;
        current.endLine = lineNumber;
        modules.push(current);
      }
    } else if (stack.length > 0) {
      const current = stack[stack.length - 1];
      const markerMatch = trimmed.match(/^(@#|@@|@|#|\$|%)/);
      if (markerMatch) {
        const marker = markerMatch[1] as '@' | '@@' | '@#' | '#' | '$' | '%';
        const markerOffset = lineStart + line.length - trimmed.length;
        const cellsStart = marker === '@#' ? markerOffset + 2 : markerOffset + marker.length;
        const cells = splitCells(text, cellsStart, lineEnd);
        if (marker === '@' || marker === '@@' || marker === '@#') {
          current.headers.push({ marker, start: markerOffset, end: lineEnd, fields: cells });
        } else if (marker === '#' || marker === '$' || marker === '%') {
          current.rows.push({ marker, start: markerOffset, end: lineEnd, cells, rowNumber: current.rows.length + 1 });
        }
      }
    }

    if (newline < 0) break;
    lineStart = newline + 1;
    lineNumber++;
  }

  for (const unclosed of stack) {
    unclosed.end = text.length;
    unclosed.endLine = lineNumber;
    modules.push(unclosed);
    diagnostics.push({ message: `Unclosed module: ${unclosed.tableTag}`, offset: unclosed.start, severity: 'warning' });
  }
  modules.sort((left, right) => left.start - right.start);
  return { tokens: tokenResult.tokens, modules, diagnostics, complete: true };
}

export interface FoldingScanResult {
  ranges: Array<{ startLine: number; endLine: number }>;
  complete: boolean;
}

export function scanFoldingRanges(text: string, isCancelled?: () => boolean): FoldingScanResult {
  const ranges: FoldingScanResult['ranges'] = [];
  const stack: Array<{ tag: string; startLine: number }> = [];
  let lineStart = 0;
  let lineNumber = 0;
  while (lineStart <= text.length) {
    if (isCancelled?.()) return { ranges: [], complete: false };
    const newline = text.indexOf('\n', lineStart);
    const lineEnd = newline < 0 ? text.length : newline;
    const line = text.slice(lineStart, lineEnd).replace(/\r$/, '');
    const parsed = parseModuleTag(line);
    if (parsed && !parsed.closing) stack.push({ tag: parsed.tag, startLine: lineNumber });
    else if (parsed?.closing) {
      const current = stack[stack.length - 1];
      if (current?.tag === parsed.tag) {
        stack.pop();
        if (lineNumber > current.startLine) ranges.push({ startLine: current.startLine, endLine: lineNumber });
      }
    }
    if (newline < 0) break;
    lineStart = newline + 1;
    lineNumber++;
  }
  return { ranges: ranges.sort((left, right) => left.startLine - right.startLine), complete: true };
}

export function getHoverContext(result: ScanResult, offset: number): HoverContext | undefined {
  for (const module of result.modules) {
    if (offset < module.start || offset > module.end) continue;
    for (const row of module.rows) {
      const cell = row.cells.find((candidate) => offset >= candidate.start && offset < candidate.end);
      if (!cell) continue;
      const header = module.headers.filter((candidate) => candidate.start <= row.start).at(-1) ?? module.headers[0];
      const fieldName = header?.fields[cell.columnIndex]?.text;
      if (!fieldName) return undefined;
      return { tableName: module.tableName, tableTag: module.tableTag, fieldName, value: cell.text, rowNumber: row.rowNumber };
    }
  }
  return undefined;
}
