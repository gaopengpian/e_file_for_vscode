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
    markdown.supportHtml = true;
    markdown.appendMarkdown(`**${tinted('--vscode-textLink-foreground', 'E-File 数据上下文')}**\n\n`);
    markdown.appendMarkdown(`- ${label('表')}：${tinted('--vscode-charts-purple', codeSpan(context.tableName))}\n`);
    markdown.appendMarkdown(`- ${label('字段')}：${tinted('--vscode-charts-blue', codeSpan(context.fieldName))}\n`);
    markdown.appendMarkdown(`- ${label('数据行')}：${tinted('--vscode-charts-orange', String(context.rowNumber))}\n\n`);
    markdown.appendMarkdown(`${label('值')}：\n`);
    markdown.appendCodeblock(context.value, 'text');
    const cell = result.modules
      .flatMap((module) => module.rows)
      .flatMap((row) => row.cells)
      .find((candidate) => offset >= candidate.start && offset < candidate.end);
    const range = cell ? new vscode.Range(document.positionAt(cell.start), document.positionAt(cell.end)) : undefined;
    return new vscode.Hover(markdown, range);
  }
}

// VS Code 只保留形如 color:var(--vscode-...); 的 span 内联样式，结尾分号不能省。
function tinted(variable: string, content: string): string {
  return `<span style="color:var(${variable});">${content}</span>`;
}

function label(text: string): string {
  return tinted('--vscode-descriptionForeground', text);
}

// 代码跨度内反斜杠是字面字符，只能靠加长反引号围栏来容纳内容里的反引号。
function codeSpan(value: string): string {
  const fence = '`'.repeat(1 + Math.max(0, ...(value.match(/`+/g) ?? []).map((run) => run.length)));
  const pad = value.startsWith('`') || value.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${value}${pad}${fence}`;
}
