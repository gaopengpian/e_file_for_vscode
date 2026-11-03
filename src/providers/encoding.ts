import * as vscode from 'vscode';
import { shouldReopenWithGbk } from '../core/encoding';

export async function reopenWithGbk(document: vscode.TextDocument): Promise<boolean> {
  if (!shouldReopenWithGbk(document.languageId, document.encoding, document.isDirty)) return false;
  const uri = document.uri;
  const key = uri.toString();
  const tabs = vscode.window.tabGroups.all.flatMap((group) =>
    group.tabs
      .filter((tab) => tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === key)
      .map((tab) => ({ tab, column: group.viewColumn }))
  );
  if (!tabs.length) return false;

  const editors = vscode.window.visibleTextEditors.filter((editor) => editor.document.uri.toString() === key);
  const columns = [...new Set(editors.map((editor) => editor.viewColumn).filter((column): column is vscode.ViewColumn => column !== undefined))];
  const activeColumn = vscode.window.activeTextEditor?.document.uri.toString() === key
    ? vscode.window.activeTextEditor.viewColumn
    : columns[0];

  let closeSubscription: vscode.Disposable | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let resolveClosed: ((closed: boolean) => void) | undefined;
  const closed = new Promise<boolean>((resolve) => { resolveClosed = resolve; });
  closeSubscription = vscode.workspace.onDidCloseTextDocument((closedDocument) => {
    if (closedDocument.uri.toString() === key) resolveClosed?.(true);
  });
  closeTimer = setTimeout(() => resolveClosed?.(false), 2000);
  const closeSucceeded = await vscode.window.tabGroups.close(tabs.map(({ tab }) => tab), true);
  if (!closeSucceeded) {
    closeSubscription.dispose();
    clearTimeout(closeTimer);
    return false;
  }

  const remainsOpen = vscode.workspace.textDocuments.some((candidate) => candidate.uri.toString() === key);
  if (remainsOpen && !(await closed)) {
    closeSubscription.dispose();
    clearTimeout(closeTimer);
    const restored = await vscode.workspace.openTextDocument(uri, { encoding: document.encoding });
    for (const column of columns) await vscode.window.showTextDocument(restored, { viewColumn: column, preview: false, preserveFocus: column !== activeColumn });
    await vscode.window.showWarningMessage('VS Code kept this E-File document open; it could not be reopened with GBK automatically. Use the encoding picker.');
    return false;
  }
  closeSubscription.dispose();
  clearTimeout(closeTimer);

  try {
    const reopened = await vscode.workspace.openTextDocument(uri, { encoding: 'gbk' });
    if (reopened.encoding.toLowerCase() !== 'gbk') throw new Error(`VS Code opened document as ${reopened.encoding}`);
    for (const column of columns) {
      await vscode.window.showTextDocument(reopened, { viewColumn: column, preview: false, preserveFocus: column !== activeColumn });
    }
    return true;
  } catch (error) {
    const fallback = await vscode.workspace.openTextDocument(uri, { encoding: document.encoding });
    for (const column of columns) await vscode.window.showTextDocument(fallback, { viewColumn: column, preview: false, preserveFocus: column !== activeColumn });
    await vscode.window.showWarningMessage(`Could not reopen E-File as GBK: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
