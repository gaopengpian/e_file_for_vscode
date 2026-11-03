import { ModuleRange, ScanResult } from './model';

export interface StructureTarget {
  moduleIndex: number;
  headerIndex?: number;
  fieldIndex?: number;
}

export function findStructureTarget(scan: ScanResult, offset: number): StructureTarget | undefined {
  for (let moduleIndex = 0; moduleIndex < scan.modules.length; moduleIndex++) {
    const module = scan.modules[moduleIndex];
    if (offset < module.start || offset > module.end) continue;
    for (let headerIndex = 0; headerIndex < module.headers.length; headerIndex++) {
      const header = module.headers[headerIndex];
      const fieldIndex = header.fields.findIndex((field) => offset >= field.start && offset < field.end);
      if (fieldIndex >= 0) return { moduleIndex, headerIndex, fieldIndex };
    }
    for (const row of module.rows) {
      const cell = row.cells.find((candidate) => offset >= candidate.start && offset < candidate.end);
      if (!cell) continue;
      let headerIndex = -1;
      for (let index = module.headers.length - 1; index >= 0; index--) {
        if (module.headers[index].start <= row.start) { headerIndex = index; break; }
      }
      return headerIndex < 0 ? { moduleIndex } : { moduleIndex, headerIndex, fieldIndex: cell.columnIndex };
    }
    return { moduleIndex };
  }
  return undefined;
}

export function getFieldNavigationOffset(text: string, module: ModuleRange, headerIndex: number, fieldIndex: number, currentOffset: number): number | undefined {
  const header = module.headers[headerIndex];
  const field = header?.fields[fieldIndex];
  if (!field) return undefined;
  const currentRow = module.rows.find((row) => currentOffset >= row.start && currentOffset <= row.end);
  const currentCell = currentRow?.cells[fieldIndex];
  if (currentCell) return currentCell.start;
  if (currentRow) {
    const nextField = currentRow.cells[fieldIndex];
    if (nextField) return nextField.start;
  }
  return field.start;
}
