import * as vscode from 'vscode';
import { formatDocument } from '../core/formatter';

function fullDocumentRange(document: vscode.TextDocument): vscode.Range {
  return new vscode.Range(new vscode.Position(0, 0), document.positionAt(document.getText().length));
}

function formatOptions(document: vscode.TextDocument): { tabSize: number; insertSpaces: boolean; maxBytes: number } {
  const configuration = vscode.workspace.getConfiguration('efile', document.uri);
  return {
    tabSize: Number(vscode.workspace.getConfiguration('editor', document.uri).get('tabSize', 4)),
    insertSpaces: Boolean(vscode.workspace.getConfiguration('editor', document.uri).get('insertSpaces', true)),
    maxBytes: Number(configuration.get('formatting.maxBytes', 1024 * 1024))
  };
}

function editFor(document: vscode.TextDocument, range?: vscode.Range, token?: vscode.CancellationToken): vscode.TextEdit[] {
  const isCancelled = () => token?.isCancellationRequested ?? false;
  if (isCancelled()) return [];
  const result = formatDocument(document.getText(), {
    ...formatOptions(document),
    range: range ? { start: document.offsetAt(range.start), end: document.offsetAt(range.end) } : undefined,
    isCancelled
  });
  if (result.skipped || result.text === document.getText()) return [];
  if (!range) return [vscode.TextEdit.replace(fullDocumentRange(document), result.text)];
  const original = document.getText();
  let start = 0;
  while (start < original.length && original[start] === result.text[start]) start++;
  let end = original.length;
  let replacementEnd = result.text.length;
  while (end > start && replacementEnd > start && original[end - 1] === result.text[replacementEnd - 1]) {
    end--;
    replacementEnd--;
  }
  return start === end ? [] : [vscode.TextEdit.replace(new vscode.Range(document.positionAt(start), document.positionAt(end)), result.text.slice(start, replacementEnd))];
}

export class EFileFormattingProvider implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {
  provideDocumentFormattingEdits(document: vscode.TextDocument, _options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.TextEdit[] {
    if (token.isCancellationRequested) return [];
    return editFor(document, undefined, token);
  }

  provideDocumentRangeFormattingEdits(document: vscode.TextDocument, range: vscode.Range, _options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.TextEdit[] {
    return editFor(document, range, token);
  }
}
