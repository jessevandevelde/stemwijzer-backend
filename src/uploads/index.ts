import { StatusCodes } from 'http-status-codes';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { readBinaryBody } from '../http/read-binary-body';
import { RequestError } from '../http/request-error';

const projectRoot = resolve(__dirname, '../..');
const maximumImageBytes = 2_097_152;
const webpMarkerOffset = 8;
const fileNameBytes = 16;

export const defaultUploadDir = process.env['UPLOAD_DIR'] ?? resolve(projectRoot, 'data/uploads');

// Geüploade bestanden krijgen altijd een willekeurige naam, dus alleen dit patroon kan ooit worden opgevraagd.
export const uploadUrlPattern = /^\/uploads\/([0-9a-f]{32}\.(?:png|jpg|gif|webp))$/u;

interface ImageType {
  readonly mimeType: string
  readonly extension: string
  readonly matches: (bytes: Buffer) => boolean
}

function startsWith(bytes: Buffer, signature: Buffer, offset = 0): boolean {
  return bytes.subarray(offset, offset + signature.length).equals(signature);
}

const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');
const jpegSignature = Buffer.from('ffd8ff', 'hex');
const gif87Signature = Buffer.from('GIF87a', 'latin1');
const gif89Signature = Buffer.from('GIF89a', 'latin1');
const riffSignature = Buffer.from('RIFF', 'latin1');
const webpSignature = Buffer.from('WEBP', 'latin1');

// SVG is bewust niet toegestaan: dat kan scripts bevatten.
const imageTypes: readonly ImageType[] = [
  { mimeType: 'image/png', extension: 'png', matches: bytes => startsWith(bytes, pngSignature) },
  { mimeType: 'image/jpeg', extension: 'jpg', matches: bytes => startsWith(bytes, jpegSignature) },
  { mimeType: 'image/gif', extension: 'gif', matches: bytes => startsWith(bytes, gif87Signature) || startsWith(bytes, gif89Signature) },
  { mimeType: 'image/webp', extension: 'webp', matches: bytes => startsWith(bytes, riffSignature) && startsWith(bytes, webpSignature, webpMarkerOffset) },
];

export async function handleUploadImageRequest(uploadDir: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const mimeType = request.headers['content-type']?.split(';')[0]?.trim().toLowerCase();
    const type = imageTypes.find(item => item.mimeType === mimeType);

    if (!type) {
      request.resume();

      throw new RequestError('Upload een PNG-, JPG-, GIF- of WebP-afbeelding.', StatusCodes.UNSUPPORTED_MEDIA_TYPE);
    }

    const bytes = await readBinaryBody(request, maximumImageBytes, 'De afbeelding mag maximaal 2 MB groot zijn.');

    if (!type.matches(bytes)) {
      throw new RequestError('Het bestand is geen geldige afbeelding van het opgegeven type.');
    }

    const fileName = `${randomBytes(fileNameBytes).toString('hex')}.${type.extension}`;

    await mkdir(uploadDir, { recursive: true });
    await writeFile(resolve(uploadDir, fileName), bytes, { flag: 'wx' });

    response.writeHead(StatusCodes.CREATED);
    response.end(JSON.stringify({ url: `/uploads/${fileName}` }));
  }
  catch (error: unknown) {
    if (response.destroyed) {
      return;
    }

    if (error instanceof RequestError) {
      response.writeHead(error.status);
      response.end(JSON.stringify({ error: error.message }));

      return;
    }

    console.error('Afbeelding uploaden mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'De afbeelding kon niet worden geüpload.' }));
  }
}

export async function handleServeUploadRequest(uploadDir: string, fileName: string, response: ServerResponse): Promise<void> {
  const type = imageTypes.find(item => fileName.endsWith(`.${item.extension}`));

  try {
    const bytes = await readFile(resolve(uploadDir, fileName));

    response.setHeader('Content-Type', type?.mimeType ?? 'application/octet-stream');
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.writeHead(StatusCodes.OK);
    response.end(bytes);
  }
  catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      response.writeHead(StatusCodes.NOT_FOUND);
      response.end(JSON.stringify({ error: 'Afbeelding niet gevonden.' }));

      return;
    }

    console.error('Afbeelding ophalen mislukt:', error);
    response.writeHead(StatusCodes.INTERNAL_SERVER_ERROR);
    response.end(JSON.stringify({ error: 'De afbeelding kon niet worden opgehaald.' }));
  }
}
