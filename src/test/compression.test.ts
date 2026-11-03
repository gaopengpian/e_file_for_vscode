import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const compression = (() => {
  try { return require('../core/compression') as Record<string, unknown>; }
  catch { return {}; }
})();
const Compressor = compression.EFileWhitespaceCompressor as (new () => NodeJS.ReadWriteStream) | undefined;
const compressLargeEFileToMemory = compression.compressLargeEFileToMemory as ((source: string, limit: number) => Promise<Buffer | undefined>) | undefined;

async function compressChunks(chunks: Buffer[]): Promise<Buffer> {
  assert.ok(Compressor, 'E-File whitespace compressor is not implemented');
  const output: Buffer[] = [];
  await pipeline(
    Readable.from(chunks),
    new Compressor(),
    new Writable({ write(chunk: Buffer, _encoding, callback) { output.push(Buffer.from(chunk)); callback(); } })
  );
  return Buffer.concat(output);
}

test('compresses runs of spaces and tabs outside single-quoted strings', async () => {
  const input = Buffer.from("<table>\r\n@  index\t\tname\r\n#  1\t\t'keep  spaces\\t inside'\r\n</table>");
  const expected = Buffer.from("<table>\r\n@ index name\r\n# 1 'keep  spaces\\t inside'\r\n</table>");
  assert.deepEqual(await compressChunks([input]), expected);
});

test('preserves escaped quotes and whitespace runs split across chunks', async () => {
  const chunks = [Buffer.from("'a'"), Buffer.from("'b  "), Buffer.from("c' \t"), Buffer.from(' x')];
  assert.deepEqual(await compressChunks(chunks), Buffer.from("'a''b  c' x"));
});

test('preserves non-ASCII source bytes while compressing adjacent spaces', async () => {
  const input = Buffer.from([0x81, 0x40, 0x20, 0x09, 0x81, 0x41]);
  assert.deepEqual(await compressChunks([input]), Buffer.from([0x81, 0x40, 0x20, 0x81, 0x41]));
});

test('returns compressed bytes in memory without writing a copy to disk', async () => {
  assert.ok(compressLargeEFileToMemory, 'In-memory large E-File compressor is not implemented');
  const dir = await mkdtemp(join(tmpdir(), 'efile-compress-'));
  try {
    const source = join(dir, 'model.e');
    const original = Buffer.from(`<table>\n@ ${' '.repeat(30)}field\n# ${' '.repeat(30)}1\n</table>`);
    await writeFile(source, original);

    const compressed = await compressLargeEFileToMemory(source, 64);

    assert.ok(compressed);
    assert.ok(compressed.length < 64);
    assert.equal(compressed.toString(), '<table>\n@ field\n# 1\n</table>');
    assert.deepEqual(await readFile(source), original);
    assert.deepEqual(await readdir(dir), ['model.e']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('returns no in-memory result when the source is small, unsupported, or cannot reach the limit', async () => {
  assert.ok(compressLargeEFileToMemory, 'In-memory large E-File compressor is not implemented');
  const dir = await mkdtemp(join(tmpdir(), 'efile-compress-'));
  try {
    const small = join(dir, 'small.e');
    const unsupported = join(dir, 'other.txt');
    const irreducible = join(dir, 'irreducible.e');
    await writeFile(small, 'small');
    await writeFile(unsupported, 'large enough to pass the custom threshold');
    await writeFile(irreducible, '<table>\n# ordinary\n</table>');

    assert.equal(await compressLargeEFileToMemory(small, 5), undefined);
    assert.equal(await compressLargeEFileToMemory(unsupported, 5), undefined);
    assert.equal(await compressLargeEFileToMemory(irreducible, 5), undefined);
    assert.deepEqual((await readdir(dir)).sort(), ['irreducible.e', 'other.txt', 'small.e']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
