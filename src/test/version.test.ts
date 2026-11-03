import test from 'node:test';
import assert from 'node:assert/strict';
import { nextPatchVersion, bumpReleaseVersions } from '../core/version';

test('increments only patch version for each package build', () => {
  assert.equal(nextPatchVersion('0.1.0'), '0.1.1');
  assert.equal(nextPatchVersion('2.4.9'), '2.4.10');
});

test('rejects non-semver package versions', () => {
  assert.throws(() => nextPatchVersion('dev'));
});

test('release version bump keeps manifest and lockfile aligned', () => {
  const manifest = { version: '0.1.4', name: 'efile' };
  const lock = { version: '0.1.4', packages: { '': { version: '0.1.4' } } };
  const next = bumpReleaseVersions(manifest, lock);
  assert.equal(next.version, '0.1.5');
  assert.equal(next.manifest.version, '0.1.5');
  assert.equal(next.lock.version, '0.1.5');
  assert.equal(next.lock.packages[''].version, '0.1.5');
});

test('release version bump rejects a manifest and lockfile mismatch', () => {
  assert.throws(() => bumpReleaseVersions({ version: '0.1.4' }, { version: '0.1.3', packages: { '': { version: '0.1.3' } } }));
});
