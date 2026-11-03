export function shouldReopenWithGbk(languageId: string, encoding: string, isDirty: boolean, scheme = 'file'): boolean {
  return languageId === 'efile' && scheme === 'file' && !isDirty && encoding.toLowerCase() !== 'gbk';
}

export function shouldScheduleGbkReopen(languageId: string, encoding: string, isDirty: boolean, alreadyScheduled: boolean, scheme = 'file'): boolean {
  return !alreadyScheduled && shouldReopenWithGbk(languageId, encoding, isDirty, scheme);
}
