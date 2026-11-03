import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { runRelease, shouldPromptForReload } from '../out/core/release.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function run(command) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, { cwd: root, stdio: 'inherit', shell: true });
    child.on('error', reject);
    child.on('exit', (code) => resolveRun(code ?? 1));
  });
}

try {
  const version = await runRelease(root, run);
  console.log(`Installed E-File ${version}.`);
  if (!shouldPromptForReload(Boolean(stdin.isTTY && stdout.isTTY), !stdin.destroyed)) {
    console.log('Reload later from the VS Code Command Palette: Developer: Reload Window.');
  } else {
    const readline = createInterface({ input: stdin, output: stdout });
    const answer = await readline.question('Reload VS Code now to activate update? [y/N] ');
    readline.close();
    if (/^y(es)?$/i.test(answer.trim())) {
      const reloadExit = await run('code --command workbench.action.reloadWindow');
      if (reloadExit !== 0) throw new Error(`VSIX ${version} installed; reload command exited with ${reloadExit}`);
    } else {
      console.log('Reload later from the VS Code Command Palette: Developer: Reload Window.');
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
