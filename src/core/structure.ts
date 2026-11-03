export function hasEFileContentSignature(lines: readonly string[]): boolean {
  let seen = 0;
  const required = 7;

  for (const line of lines.slice(0, 100)) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//')) continue;

    const marker = trimmed[0];
    if (marker !== '<' && marker !== '@' && marker !== '#') {
      seen = 0;
      continue;
    }

    seen |= marker === '<' ? 1 : marker === '@' ? 2 : 4;
    if (seen === required) return true;
  }

  return false;
}

export function shouldShowStructure(languageId: string): boolean {
  return languageId === 'efile';
}
