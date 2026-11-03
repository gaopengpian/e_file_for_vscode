import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { bumpReleaseVersions } from './version';

export type ReleaseRunner = (command: string) => Promise<number>;

export function shouldPromptForReload(isTTY: boolean, stdinReadable: boolean): boolean {
  return isTTY && stdinReadable;
}

export async function runRelease(root: string, run: ReleaseRunner): Promise<string> {
  for (const command of ['npm test', 'npm run check']) {
    const exitCode = await run(command);
    if (exitCode !== 0) throw new Error(`Release stopped: ${command} exited with ${exitCode}`);
  }

  const manifestPath = join(root, 'package.json');
  const lockPath = join(root, 'package-lock.json');
  const manifestText = await readFile(manifestPath, 'utf8');
  const lockText = await readFile(lockPath, 'utf8');
  const { manifest, lock, version } = bumpReleaseVersions(JSON.parse(manifestText), JSON.parse(lockText));
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

  const packageExit = await run('npm run package');
  if (packageExit !== 0) throw new Error(`Release stopped: npm run package exited with ${packageExit}`);
  const installExit = await run(`code --install-extension efile-language-support-${version}.vsix --force`);
  if (installExit !== 0) throw new Error(`VSIX ${version} was packaged but installation failed with ${installExit}`);
  return version;
}
