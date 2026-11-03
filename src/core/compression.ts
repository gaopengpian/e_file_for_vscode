import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { Transform, TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const LARGE_EFILE_LIMIT = 50 * 1024 * 1024;
const SUPPORTED_EFILE_EXTENSIONS = new Set(['.e', '.dt', '.cim', '.cime']);

export class EFileWhitespaceCompressor extends Transform {
  private inString = false;
  private pendingQuote = false;
  private pendingWhitespace = false;

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    const output = Buffer.allocUnsafe(chunk.length + 1);
    let length = 0;

    for (const byte of chunk) {
      if (this.pendingQuote) {
        if (byte === 0x27) {
          output[length++] = 0x27;
          output[length++] = 0x27;
          this.pendingQuote = false;
          continue;
        }
        output[length++] = 0x27;
        this.pendingQuote = false;
        this.inString = false;
      }

      if (this.inString) {
        if (byte === 0x27) this.pendingQuote = true;
        else output[length++] = byte;
        continue;
      }

      if (byte === 0x20 || byte === 0x09) {
        this.pendingWhitespace = true;
        continue;
      }

      if (this.pendingWhitespace) {
        output[length++] = 0x20;
        this.pendingWhitespace = false;
      }
      output[length++] = byte;
      if (byte === 0x27) this.inString = true;
    }

    callback(null, output.subarray(0, length));
  }

  override _flush(callback: TransformCallback): void {
    if (this.pendingQuote) this.push(Buffer.from("'"));
    if (this.pendingWhitespace) this.push(Buffer.from(' '));
    callback();
  }
}

export async function compressLargeEFileToMemory(sourcePath: string, limit = LARGE_EFILE_LIMIT): Promise<Buffer | undefined> {
  const before = await stat(sourcePath);
  if (!SUPPORTED_EFILE_EXTENSIONS.has(extname(sourcePath).toLowerCase()) || before.size <= limit) return undefined;

  const chunks: Buffer[] = [];
  await pipeline(
    createReadStream(sourcePath),
    new EFileWhitespaceCompressor(),
    new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      }
    })
  );

  const after = await stat(sourcePath);
  if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) return undefined;

  const result = Buffer.concat(chunks);
  return result.length < limit ? result : undefined;
}
