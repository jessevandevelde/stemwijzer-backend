import { StatusCodes } from 'http-status-codes';
import type { IncomingMessage } from 'node:http';
import { RequestError } from './request-error';

export async function readBinaryBody(request: IncomingMessage, maximumBytes: number, tooLargeMessage: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;

    function onData(chunk: Buffer): void {
      bytes += chunk.length;

      if (bytes > maximumBytes) {
        chunks.length = 0;
        request.removeListener('data', onData);
        request.resume();
        reject(new RequestError(tooLargeMessage, StatusCodes.REQUEST_TOO_LONG));

        return;
      }

      chunks.push(chunk);
    }

    request.on('data', onData);
    request.once('error', reject);
    request.once('aborted', () => {
      reject(new RequestError('De aanvraag is afgebroken.'));
    });
    request.once('end', () => {
      if (bytes <= maximumBytes) {
        resolve(Buffer.concat(chunks));
      }
    });
  });
}
