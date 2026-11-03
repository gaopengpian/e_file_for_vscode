import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nextPatchVersion } from '../src/core/version';

const root = process.cwd();
const manifestPath = join(root, 'package.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { version: string } & Record<string, unknown>;
manifest.version = nextPatchVersion(manifest.version);
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Bumped plugin version to ${manifest.version}`);
