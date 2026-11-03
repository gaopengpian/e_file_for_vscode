export type TokenKind =
  | 'whitespace'
  | 'comment'
  | 'tagStart'
  | 'tagEnd'
  | 'tagCloseStart'
  | 'tagInfoStart'
  | 'tagInfoEnd'
  | 'markerAt'
  | 'markerAtAt'
  | 'markerAtHash'
  | 'markerHash'
  | 'markerDollar'
  | 'markerPercent'
  | 'string'
  | 'identifier'
  | 'tagIdentifier'
  | 'doubleColon';

export interface Token {
  kind: TokenKind;
  start: number;
  end: number;
  line: number;
  column: number;
  text: string;
}

export interface CellRange {
  text: string;
  start: number;
  end: number;
  columnIndex: number;
}

export interface HeaderRange {
  marker: '@' | '@@' | '@#';
  start: number;
  end: number;
  fields: CellRange[];
}

export interface RowRange {
  marker: '#' | '$' | '%';
  start: number;
  end: number;
  cells: CellRange[];
  rowNumber: number;
}

export interface ModuleRange {
  tableName: string;
  tableTag: string;
  start: number;
  end: number;
  startLine: number;
  endLine: number;
  headers: HeaderRange[];
  rows: RowRange[];
}

export interface ScanDiagnostic {
  message: string;
  offset: number;
  severity: 'warning';
}

export interface FoldingRangeData {
  startLine: number;
  endLine: number;
}

export interface ScanResult {
  tokens: Token[];
  modules: ModuleRange[];
  diagnostics: ScanDiagnostic[];
  complete: boolean;
}

export interface HoverContext {
  tableName: string;
  tableTag: string;
  fieldName: string;
  value: string;
  rowNumber: number;
}
