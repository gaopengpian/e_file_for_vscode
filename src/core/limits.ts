export function exceedsAnalysisLimit(text: string, maxBytes: number): boolean {
  return Buffer.byteLength(text, 'utf8') > maxBytes;
}
