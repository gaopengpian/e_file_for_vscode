import { ModuleRange, ScanResult } from './model';

export interface StructureIndexNode {
  key: string;
  label: string;
  kind: 'module' | 'field';
  moduleIndex: number;
  headerIndex?: number;
  fieldIndex?: number;
  start: number;
  end: number;
  parentKey?: string;
  children: StructureIndexNode[];
}

export function buildStructureIndex(scan: ScanResult): StructureIndexNode[] {
  return scan.modules.map((module, moduleIndex) => moduleNode(module, moduleIndex));
}

function moduleNode(module: ModuleRange, moduleIndex: number): StructureIndexNode {
  const key = `${moduleIndex}`;
  return {
    key,
    label: `${module.tableName} [${module.rows.length}]`,
    kind: 'module',
    moduleIndex,
    start: module.start,
    end: module.end,
    children: module.headers.flatMap((header, headerIndex) => header.fields.map((field, fieldIndex) => ({
      key: `${moduleIndex}:${headerIndex}:${fieldIndex}`,
      label: field.text,
      kind: 'field' as const,
      moduleIndex,
      headerIndex,
      fieldIndex,
      start: field.start,
      end: field.end,
      parentKey: key,
      children: []
    })))
  };
}
