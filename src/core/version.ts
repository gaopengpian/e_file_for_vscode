export function nextPatchVersion(version: string): string {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  if (!match) throw new Error(`Invalid stable semantic version: ${version}`);
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

export interface ReleaseLock {
  version: string;
  packages: Record<string, { version?: string }>;
}

export function bumpReleaseVersions<T extends { version: string }, L extends ReleaseLock>(manifest: T, lock: L): { manifest: T; lock: L; version: string } {
  const rootVersion = lock.packages['']?.version;
  if (manifest.version !== lock.version || manifest.version !== rootVersion) {
    throw new Error(`Manifest (${manifest.version}) and lockfile (${lock.version}/${rootVersion}) versions do not match`);
  }
  const version = nextPatchVersion(manifest.version);
  return {
    manifest: { ...manifest, version },
    lock: { ...lock, version, packages: { ...lock.packages, '': { ...lock.packages[''], version } } },
    version
  };
}
