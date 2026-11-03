import * as vscode from 'vscode';
import { getHoverContext } from '../core/hover';
import { getCachedScan } from '../core/scanCache';

export class EFileHoverProvider implements vscode.HoverProvider {
  provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.Hover | undefined {
    if (token.isCancellationRequested) return undefined;
    if (!vscode.workspace.getConfiguration('efile', document.uri).get('enableHoverDetails', true)) return undefined;
    const result = getCachedScan(document, document.version, document.getText(), { isCancelled: () => token.isCancellationRequested });
    if (!result.complete || token.isCancellationRequested) return undefined;
    const offset = document.offsetAt(position);
    const context = getHoverContext(result, offset);
    if (!context) return undefined;

    const markdown = new vscode.MarkdownString();
    markdown.appendMarkdown('**E-File 数据上下文**\n\n');
    markdown.appendMarkdown(`- 表：\`${escapeMarkdown(context.tableName)}\`\n`);
    markdown.appendMarkdown(`- 字段：\`${escapeMarkdown(context.fieldName)}\`\n`);
    markdown.appendMarkdown(`- 数据行：${context.rowNumber}\n\n`);
    markdown.appendMarkdown('值：\n');
    markdown.appendCodeblock(context.value, 'text');
    const cell = result.modules
      .flatMap((module) => module.rows)
      .flatMap((row) => row.cells)
      .find((candidate) => offset >= candidate.start && offset < candidate.end);
    const range = cell ? new vscode.Range(document.positionAt(cell.start), document.positionAt(cell.end)) : undefined;
    return new vscode.Hover(markdown, range);
  }
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+.!|>\-]/g, '\\$&');
}
