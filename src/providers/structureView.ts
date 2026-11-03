import * as vscode from 'vscode';
import { ScanResult } from '../core/model';
import { buildStructureIndex, StructureIndexNode } from '../core/structureIndex';
import { getCachedScan } from '../core/scanCache';
import { findStructureTarget } from '../core/structureNavigation';

export class StructureItem extends vscode.TreeItem {
  constructor(public readonly data: StructureIndexNode, selected = false) {
    super(data.label, data.kind === 'module' && data.children.length ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);
    this.description = data.kind === 'module' ? undefined : 'field';
    this.command = { command: 'efile.revealStructureItem', title: 'Reveal E-File structure item', arguments: [data.key] };
    this.contextValue = data.kind;
    if (selected) this.iconPath = new vscode.ThemeIcon('list-selection');
  }
}

export class EFileStructureProvider implements vscode.TreeDataProvider<StructureItem>, vscode.Disposable {
  private readonly changed = new vscode.EventEmitter<StructureItem | undefined | void>();
  readonly onDidChangeTreeData = this.changed.event;
  private document?: vscode.TextDocument;
  private scan?: ScanResult;
  private items: StructureIndexNode[] = [];
  private selectedKey?: string;

  refresh(document?: vscode.TextDocument): void {
    this.document = document;
    this.scan = document ? getCachedScan(document, document.version, document.getText()) : undefined;
    this.items = document && this.scan?.complete ? buildStructureIndex(this.scan) : [];
    if (this.selectedKey && !this.getItemData(this.selectedKey)) this.selectedKey = undefined;
    this.changed.fire();
  }

  getTreeItem(element: StructureItem): vscode.TreeItem {
    return new StructureItem(element.data, element.data.key === this.selectedKey);
  }

  getFirstModule(): StructureItem | undefined {
    const item = this.items[0];
    return item ? new StructureItem(item, item.key === this.selectedKey) : undefined;
  }

  getItem(key: string): StructureItem | undefined {
    const item = this.getItemData(key);
    return item ? new StructureItem(item, item.key === this.selectedKey) : undefined;
  }

  getChildren(element?: StructureItem): StructureItem[] {
    return (element ? element.data.children : this.items).map((item) => new StructureItem(item, item.key === this.selectedKey));
  }

  getParent(element: StructureItem): StructureItem | undefined {
    if (!element.data.parentKey) return undefined;
    const parent = this.getItemData(element.data.parentKey);
    return parent ? new StructureItem(parent, parent.key === this.selectedKey) : undefined;
  }

  getItemData(key: string): StructureIndexNode | undefined {
    for (const module of this.items) {
      if (module.key === key) return module;
      const field = module.children.find((child) => child.key === key);
      if (field) return field;
    }
    return undefined;
  }

  selectAt(position: vscode.Position): StructureItem | undefined {
    if (!this.document || !this.scan) return undefined;
    const target = findStructureTarget(this.scan, this.document.offsetAt(position));
    if (!target) return undefined;
    const module = this.items[target.moduleIndex];
    if (!module) return undefined;
    const selected = target.fieldIndex === undefined
      ? module
      : module.children.find((item) => item.headerIndex === target.headerIndex && item.fieldIndex === target.fieldIndex) ?? module;
    if (this.selectedKey !== selected.key) {
      this.selectedKey = selected.key;
      this.changed.fire();
    }
    return new StructureItem(selected, true);
  }

  getField(moduleIndex: number, headerIndex: number, fieldIndex: number): StructureItem | undefined {
    const item = this.items[moduleIndex]?.children.find((child) => child.headerIndex === headerIndex && child.fieldIndex === fieldIndex);
    return item ? new StructureItem(item, item.key === this.selectedKey) : undefined;
  }

  getModule(moduleIndex: number) {
    return this.scan?.modules[moduleIndex];
  }

  revealAt(editor: vscode.TextEditor, position: vscode.Position): StructureItem | undefined {
    if (!this.document || editor.document.uri.toString() !== this.document.uri.toString()) return undefined;
    return this.selectAt(position);
  }

  dispose(): void { this.changed.dispose(); }
}
