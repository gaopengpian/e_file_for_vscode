import { ScanResult } from './model';
import { scanDocument, ScanOptions } from './scanner';

interface CachedScan {
  version: number;
  result: ScanResult;
}

const cache = new WeakMap<object, CachedScan>();

export function getCachedScan(document: object, version: number, text: string, options: ScanOptions = {}): ScanResult {
  const cached = cache.get(document);
  if (cached?.version === version) return cached.result;
  const result = scanDocument(text, { includeTokens: false, ...options });
  if (result.complete) cache.set(document, { version, result });
  return result;
}
