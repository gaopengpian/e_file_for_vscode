import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runRelease, shouldPromptForReload } from '../core/release';

test('release tests, bumps both versions, packages and installs the bumped VSIX', async () => {
  const root = mkdtempSync(join(tmpdir(), 'efile-release-'));
  const calls: string[] = [];
  try {
    mkdirSync(join(root, 'scripts'), { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'efile', version: '0.1.4', scripts: {} }));
    writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ name: 'efile', version: '0.1.4', lockfileVersion: 3, packages: { '': { name: 'efile', version: '0.1.4' } } }));
    const version = await runRelease(root, async (command) => {
      calls.push(command);
      if (command === 'npm test' || command === 'npm run check') return 0;
      if (command === 'npm run package') {
        const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
        writeFileSync(join(root, `efile-language-support-${manifest.version}.vsix`), 'vsix');
        return 0;
      }
      return command.startsWith('code --install-extension ') ? 0 : 1;
    });
    const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
    assert.equal(version, '0.1.5');
    assert.equal(lock.version, '0.1.5');
    assert.equal(lock.packages[''].version, '0.1.5');
    assert.deepEqual(calls, ['npm test', 'npm run check', 'npm run package', 'code --install-extension efile-language-support-0.1.5.vsix --force']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('release does not bump version when tests fail', async () => {
  const root = mkdtempSync(join(tmpdir(), 'efile-release-'));
  try {
    mkdirSync(join(root, 'scripts'), { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'efile', version: '0.1.4', scripts: {} }));
    writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ name: 'efile', version: '0.1.4', packages: { '': { name: 'efile', version: '0.1.4' } } }));
    await assert.rejects(runRelease(root, async () => 1));
    assert.equal(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version, '0.1.4');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('skips reload prompt in non-interactive release runs', () => {
  assert.equal(shouldPromptForReload(true, true), true);
  assert.equal(shouldPromptForReload(true, false), false);
  assert.equal(shouldPromptForReload(false, true), false);
  assert.equal(shouldPromptForReload(false, false), false);
});
