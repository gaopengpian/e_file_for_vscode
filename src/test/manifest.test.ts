import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('uses the user-owned Marketplace publisher ID', () => {
  const manifest = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));
  assert.equal(manifest.publisher, '536f8f74-6f8f-612e-b02d-11545322a06b');
});

test('contributes GBK defaults for E-File language', () => {
  const manifest = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));
  assert.equal(manifest.contributes.configurationDefaults['[efile]']['files.encoding'], 'gbk');
  assert.equal(manifest.contributes.configurationDefaults['[efile]']['files.autoGuessEncoding'], false);
});

test('contributes default E-file language association for supported extensions', () => {
  const manifest = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));
  const language = manifest.contributes.languages.find((entry: { id: string }) => entry.id === 'efile');
  assert.ok(language.extensions.includes('.e'));
  assert.ok(language.extensions.includes('.E'));
  assert.ok(language.extensions.includes('.dt'));
  assert.ok(language.extensions.includes('.cim'));
  assert.ok(language.extensions.includes('.cime'));
  assert.equal(manifest.contributes.configurationDefaults['files.associations']['*.e'], 'efile');
  assert.equal(manifest.contributes.configurationDefaults['files.associations']['*.E'], 'efile');
  assert.equal(manifest.contributes.configurationDefaults['files.associations']['*.dt'], 'efile');
  assert.equal(manifest.contributes.configurationDefaults['files.associations']['*.cim'], 'efile');
  assert.equal(manifest.contributes.configurationDefaults['files.associations']['*.cime'], 'efile');
  assert.ok(manifest.activationEvents.includes('onLanguage:plaintext'));
});

test('contributes a manual large-file compression command in both right-click menus', () => {
  const manifest = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));
  assert.ok(manifest.contributes.commands.some((command: { command: string }) => command.command === 'efile.compressLargeFile'));
  assert.ok(!manifest.activationEvents.includes('onStartupFinished'));
  assert.ok(manifest.contributes.menus['explorer/context'].some((item: { command: string }) => item.command === 'efile.compressLargeFile'));
  assert.ok(manifest.contributes.menus['editor/context'].some((item: { command: string }) => item.command === 'efile.compressLargeFile'));
  assert.equal(manifest.contributes.menus['explorer/context'][0].when, 'resourceExtname == .e || resourceExtname == .E || resourceExtname == .dt || resourceExtname == .cim || resourceExtname == .cime');
});

test('keeps E-File Structure available in the Explorer view container', () => {
  const manifest = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));
  const view = manifest.contributes.views.explorer.find((entry: { id: string }) => entry.id === 'efile.structure');
  assert.ok(view);
  assert.equal(view.when, undefined);
});

test('uses one release command for version bump, VSIX install, and VS Code reload prompt', () => {
  const manifest = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));
  assert.equal(manifest.scripts.release, 'node scripts/release.mjs');
});
