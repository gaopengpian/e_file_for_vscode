import * as vscode from 'vscode';
import { EFileDocumentSymbolProvider } from './providers/symbols';
import { EFileFoldingProvider } from './providers/folding';
import { EFileFormattingProvider } from './providers/formatting';
import { EFileHoverProvider } from './providers/hover';
import { EFileDecorationController } from './providers/decorations';
import { EFileStructureProvider, StructureItem } from './providers/structureView';
import { reopenWithGbk } from './providers/encoding';
import { compressLargeEFileToMemory, LARGE_EFILE_LIMIT } from './core/compression';
import { shouldScheduleGbkReopen } from './core/encoding';
import { shouldShowStructure, hasEFileContentSignature } from './core/structure';
import { getFieldNavigationOffset } from './core/structureNavigation';

export function activate(context: vscode.ExtensionContext): void {
  const selector: vscode.DocumentSelector = [
    { language: 'efile', scheme: 'file' },
    { language: 'efile', scheme: 'untitled' }
  ];
  const decorations = new EFileDecorationController();
  const structure = new EFileStructureProvider();
  const tree = vscode.window.createTreeView<StructureItem>('efile.structure', {
    treeDataProvider: structure,
    showCollapseAll: true
  });
  const formatting = new EFileFormattingProvider();
  const encodingChecks = new WeakSet<vscode.TextDocument>();
  const detectionChecks = new WeakSet<vscode.TextDocument>();
  const ensureGbk = (document: vscode.TextDocument): void => {
    if (!shouldScheduleGbkReopen(document.languageId, document.encoding, document.isDirty, encodingChecks.has(document), document.uri.scheme)) return;
    encodingChecks.add(document);
    void reopenWithGbk(document).finally(() => encodingChecks.delete(document));
  };
  const detectPlaintext = async (document: vscode.TextDocument): Promise<void> => {
    if (detectionChecks.has(document) || document.languageId !== 'plaintext' || document.uri.scheme !== 'file') return;
    detectionChecks.add(document);
    const lines = Array.from({ length: Math.min(document.lineCount, 100) }, (_, line) => document.lineAt(line).text);
    if (!hasEFileContentSignature(lines)) return;
    const efile = await vscode.languages.setTextDocumentLanguage(document, 'efile');
    ensureGbk(efile);
    const editor = vscode.window.visibleTextEditors.find((item) => item.document.uri.toString() === efile.uri.toString());
    if (editor) decorations.refresh(editor);
    structure.refresh(efile);
    void showStructure(efile);
  };
  const showCompressedInMemory = async (sourcePath: string): Promise<void> => {
    try {
      const compressed = await compressLargeEFileToMemory(sourcePath, LARGE_EFILE_LIMIT);
      if (!compressed) {
        await vscode.window.showInformationMessage('E-File 未打开压缩内容：原文件不超过 50 MiB，或压缩结果仍不小于 50 MiB。');
        return;
      }
      const sourceUri = vscode.Uri.file(sourcePath);
      const sourceDocument = vscode.workspace.textDocuments.find((document) => document.uri.toString() === sourceUri.toString());
      const encoding = sourceDocument?.encoding ?? 'gbk';
      const text = await vscode.workspace.decode(compressed, { encoding });
      const untitled = await vscode.workspace.openTextDocument({ language: 'efile', content: text });
      await vscode.commands.executeCommand('vscode.open', sourceUri, { preserveFocus: true, preview: false });
      await vscode.window.showTextDocument(untitled, { viewColumn: vscode.ViewColumn.Beside, preview: false });
      await vscode.window.showInformationMessage(`已在内存中打开压缩内容，约 ${(compressed.length / 1024 / 1024).toFixed(1)} MiB。编辑后需另存为才能写入磁盘。`);
    } catch (error) {
      await vscode.window.showErrorMessage(`E-File 压缩失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const showStructure = async (document: vscode.TextDocument): Promise<void> => {
    if (!shouldShowStructure(document.languageId)) return;
    await vscode.commands.executeCommand('workbench.view.explorer');
    structure.refresh(document);
    const firstModule = structure.getFirstModule();
    if (firstModule) await tree.reveal(firstModule, { focus: false, select: false, expand: 1 });
  };
  const revealStructureItem = async (key: string): Promise<void> => {
    const editor = vscode.window.activeTextEditor;
    const item = structure.getItem(key);
    if (!editor || editor.document.languageId !== 'efile' || !item) return;
    const currentOffset = editor.document.offsetAt(editor.selection.active);
    const currentTarget = structure.selectAt(editor.selection.active);
    const sameModule = currentTarget?.data.moduleIndex === item.data.moduleIndex;
    const module = structure.getModule(item.data.moduleIndex);
    if (item.data.kind === 'field' && (!module || item.data.headerIndex === undefined || item.data.fieldIndex === undefined)) return;
    const targetOffset = module && item.data.kind === 'field'
      ? getFieldNavigationOffset(editor.document.getText(), module, item.data.headerIndex!, item.data.fieldIndex!, currentOffset)
      : item.data.start;
    if (targetOffset === undefined) return;
    const targetPosition = editor.document.positionAt(targetOffset);
    const oldVisible = editor.visibleRanges[0];
    editor.selection = new vscode.Selection(targetPosition, targetPosition);
    if (sameModule && oldVisible) {
      editor.revealRange(new vscode.Range(targetPosition, targetPosition), vscode.TextEditorRevealType.Default);
    } else {
      editor.revealRange(new vscode.Range(targetPosition, targetPosition), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }
    await tree.reveal(item, { focus: false, select: true, expand: true });
  };

  const disposables: vscode.Disposable[] = [
    vscode.languages.registerFoldingRangeProvider(selector, new EFileFoldingProvider()),
    vscode.languages.registerDocumentSymbolProvider(selector, new EFileDocumentSymbolProvider()),
    vscode.languages.registerDocumentFormattingEditProvider(selector, formatting),
    vscode.languages.registerDocumentRangeFormattingEditProvider(selector, formatting),
    vscode.languages.registerHoverProvider(selector, new EFileHoverProvider()),
    vscode.commands.registerCommand('efile.formatDocument', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'efile') return;
      await vscode.commands.executeCommand('editor.action.formatDocument');
    }),
    vscode.commands.registerCommand('efile.showStructure', async () => {
      if (tree.selection[0]) {
        await tree.reveal(tree.selection[0], { focus: true, select: false });
      } else {
        await vscode.commands.executeCommand('workbench.action.focusSideBar');
      }
    }),
    vscode.commands.registerCommand('efile.revealStructureItem', (key: string) => revealStructureItem(key)),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) void detectPlaintext(editor.document);
      if (editor?.document.languageId === 'efile') {
        ensureGbk(editor.document);
        decorations.refresh(editor);
        structure.refresh(editor.document);
        void showStructure(editor.document);
      } else if (editor) {
        decorations.clear(editor);
        structure.refresh();
      } else {
        structure.refresh();
      }
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (event.textEditor.document.languageId === 'efile') {
        decorations.refreshActive(event.textEditor);
        const item = structure.revealAt(event.textEditor, event.selections[0].active);
        if (item) void tree.reveal(item, { focus: false, select: true, expand: true });
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document.uri.toString() === event.document.uri.toString()) decorations.refresh(editor);
      }
      const active = vscode.window.activeTextEditor;
      if (active?.document.uri.toString() === event.document.uri.toString()) structure.refresh(active.document);
    }),
    vscode.commands.registerCommand('efile.compressLargeFile', async (resource?: vscode.Uri) => {
      const uri = resource ?? vscode.window.activeTextEditor?.document.uri;
      if (!uri || uri.scheme !== 'file') return;
      showCompressedInMemory(uri.fsPath);
    }),
    vscode.commands.registerCommand('efile.reopenWithGBK', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'efile') return;
      if (editor.document.isDirty) {
        await vscode.window.showWarningMessage('E-File 未保存；保存前不会自动重开或丢弃修改。');
        return;
      }
      await reopenWithGbk(editor.document);
    })
  ];

  context.subscriptions.push(...disposables, decorations, structure, tree);

  const active = vscode.window.activeTextEditor;
  if (active) {
    ensureGbk(active.document);
    void detectPlaintext(active.document);
    if (active.document.languageId === 'efile') {
      decorations.refresh(active);
      structure.refresh(active.document);
      void showStructure(active.document);
    }
  }
}

export function deactivate(): void {
  // VS Code disposes registered subscriptions from ExtensionContext.
}
