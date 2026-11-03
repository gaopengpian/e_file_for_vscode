import * as vscode from 'vscode';
import { ModuleRange } from '../core/model';
import { scanDocument } from '../core/scanner';

function documentRange(document: vscode.TextDocument, start: number, end: number): vscode.Range {
  return new vscode.Range(document.positionAt(start), document.positionAt(end));
}

function symbolForModule(document: vscode.TextDocument, module: ModuleRange): vscode.DocumentSymbol {
  const range = documentRange(document, module.start, module.end);
  const children = module.headers.map((header) => {
    const headerRange = documentRange(document, header.start, header.end);
    const fields = header.fields.map((field) => field.text).join(', ');
    return new vscode.DocumentSymbol(`${header.marker} ${fields}`, 'data fields', vscode.SymbolKind.Field, headerRange, headerRange);
  });
  return new vscode.DocumentSymbol(module.tableName, module.tableTag, vscode.SymbolKind.Namespace, range, documentRange(document, module.start, Math.min(module.end, module.start + module.tableTag.length + 2)));
}

export class EFileDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.DocumentSymbol[] {
    const result = scanDocument(document.getText(), { isCancelled: () => token.isCancellationRequested, includeTokens: false });
    if (!result.complete) return [];
    return result.modules.map((module) => {
      const symbol = symbolForModule(document, module);
      symbol.children = module.headers.map((header) => {
        const range = documentRange(document, header.start, header.end);
        const fields = header.fields.map((field) => field.text).join(', ');
        return new vscode.DocumentSymbol(`${header.marker} ${fields}`, 'data fields', vscode.SymbolKind.Field, range, range);
      });
      return symbol;
    });
  }
}
