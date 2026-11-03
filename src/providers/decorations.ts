import * as vscode from 'vscode';
import { getCachedScan } from '../core/scanCache';
import { exceedsAnalysisLimit } from '../core/limits';

const palette = [
  new vscode.ThemeColor('editorInfo.foreground'),
  new vscode.ThemeColor('editorWarning.foreground'),
  new vscode.ThemeColor('editorHint.foreground'),
  new vscode.ThemeColor('charts.blue'),
  new vscode.ThemeColor('charts.green'),
  new vscode.ThemeColor('charts.orange'),
  new vscode.ThemeColor('charts.purple')
];

interface DecorationCache {
  version: number;
  ranges: vscode.Range[][];
  cells: Array<{ start: number; end: number; range: vscode.Range }>;
}

export class EFileDecorationController implements vscode.Disposable {
  private readonly types = palette.map((color) => vscode.window.createTextEditorDecorationType({ color }));
  private readonly activeType = vscode.window.createTextEditorDecorationType({ fontWeight: 'bold', border: '1px solid', borderColor: 'editorError.foreground' });
  private readonly cache = new WeakMap<vscode.TextDocument, DecorationCache>();

  refresh(editor: vscode.TextEditor): void {
    if (editor.document.languageId !== 'efile' || !vscode.workspace.getConfiguration('efile', editor.document.uri).get('enableRainbowColumns', true)) {
      this.clear(editor);
      return;
    }
    const text = editor.document.getText();
    if (exceedsAnalysisLimit(text, 1024 * 1024)) {
      this.clear(editor);
      this.cache.delete(editor.document);
      return;
    }
    let cached = this.cache.get(editor.document);
    if (cached?.version !== editor.document.version) {
      const result = getCachedScan(editor.document, editor.document.version, text);
      if (!result.complete) {
        this.clear(editor);
        return;
      }
      const ranges: vscode.Range[][] = this.types.map(() => []);
      const cells: DecorationCache['cells'] = [];
      for (const module of result.modules) {
        for (const line of [...module.headers, ...module.rows]) {
          const lineCells = 'fields' in line ? line.fields : line.cells;
          for (const cell of lineCells) {
            const range = new vscode.Range(editor.document.positionAt(cell.start), editor.document.positionAt(cell.end));
            ranges[cell.columnIndex % ranges.length].push(range);
            cells.push({ start: cell.start, end: cell.end, range });
          }
        }
      }
      cached = { version: editor.document.version, ranges, cells: cells.sort((left, right) => left.start - right.start) };
      this.cache.set(editor.document, cached);
    }
    this.types.forEach((type, index) => editor.setDecorations(type, cached.ranges[index]));
    this.refreshActiveCached(editor, cached);
  }

  refreshActive(editor: vscode.TextEditor): void {
    const cached = this.cache.get(editor.document);
    this.refreshActiveCached(editor, cached?.version === editor.document.version ? cached : undefined);
  }

  clear(editor: vscode.TextEditor): void {
    this.types.forEach((type) => editor.setDecorations(type, []));
    editor.setDecorations(this.activeType, []);
  }

  dispose(): void {
    this.types.forEach((type) => type.dispose());
    this.activeType.dispose();
  }

  private refreshActiveCached(editor: vscode.TextEditor, cached?: DecorationCache): void {
    if (!cached) {
      editor.setDecorations(this.activeType, []);
      return;
    }
    const offset = editor.document.offsetAt(editor.selection.active);
    let low = 0;
    let high = cached.cells.length - 1;
    let active: vscode.Range | undefined;
    while (low <= high) {
      const middle = (low + high) >>> 1;
      const cell = cached.cells[middle];
      if (offset < cell.start) high = middle - 1;
      else if (offset >= cell.end) low = middle + 1;
      else { active = cell.range; break; }
    }
    editor.setDecorations(this.activeType, active ? [active] : []);
  }
}
