import * as vscode from 'vscode';
import { scanFoldingRanges } from '../core/scanner';

export class EFileFoldingProvider implements vscode.FoldingRangeProvider {
  provideFoldingRanges(document: vscode.TextDocument, _context: vscode.FoldingContext, token: vscode.CancellationToken): vscode.FoldingRange[] {
    const result = scanFoldingRanges(document.getText(), () => token.isCancellationRequested);
    if (!result.complete) return [];
    return result.ranges.map((range) => new vscode.FoldingRange(range.startLine, range.endLine));
  }
}
