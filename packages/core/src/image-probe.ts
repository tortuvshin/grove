/**
 * Read an image's format and pixel size from the first bytes of the
 * file, so sync can describe a logo or screenshot candidate without
 * downloading it. Callers fetch a small byte range (see
 * {@link IMAGE_PROBE_BYTES}) and hand it here; nothing in this module
 * touches the network.
 */

export type ImageFormat = 'png' | 'jpeg' | 'gif' | 'webp' | 'svg' | 'ico' | 'avif';

export interface ImageFacts {
  format?: ImageFormat;
  width?: number;
  height?: number;
}

/**
 * Bytes a range request asks for. Enough for the PNG, GIF and WebP
 * headers and for the opening `<svg …>` tag; a JPEG's frame header
 * usually sits past its EXIF block but inside this window.
 */
export const IMAGE_PROBE_BYTES = 16_384;

const EXTENSION_FORMATS: Record<string, ImageFormat> = {
  png: 'png',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  gif: 'gif',
  webp: 'webp',
  svg: 'svg',
  ico: 'ico',
  avif: 'avif',
};

/** Image format implied by a path or URL's extension. */
export function imageFormatFromPath(path: string): ImageFormat | undefined {
  const clean = path.split(/[?#]/)[0] ?? path;
  const ext = clean.slice(clean.lastIndexOf('.') + 1).toLowerCase();
  return EXTENSION_FORMATS[ext];
}

function positive(n: number): number | undefined {
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

function facts(format: ImageFormat, width?: number, height?: number): ImageFacts {
  return { format, ...(width ? { width } : {}), ...(height ? { height } : {}) };
}

function pngFacts(b: Uint8Array): ImageFacts | undefined {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24 || !sig.every((v, i) => b[i] === v)) return undefined;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return facts('png', positive(view.getUint32(16)), positive(view.getUint32(20)));
}

function gifFacts(b: Uint8Array): ImageFacts | undefined {
  if (b.length < 10 || b[0] !== 0x47 || b[1] !== 0x49 || b[2] !== 0x46) return undefined;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return facts('gif', positive(view.getUint16(6, true)), positive(view.getUint16(8, true)));
}

function ascii(b: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...b.subarray(start, start + length));
}

function webpFacts(b: Uint8Array): ImageFacts | undefined {
  if (b.length < 30 || ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return undefined;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const chunk = ascii(b, 12, 4);
  if (chunk === 'VP8X') {
    const width = 1 + (view.getUint16(24, true) | ((b[26] ?? 0) << 16));
    const height = 1 + (view.getUint16(27, true) | ((b[29] ?? 0) << 16));
    return facts('webp', positive(width), positive(height));
  }
  if (chunk === 'VP8 ') {
    return facts(
      'webp',
      positive(view.getUint16(26, true) & 0x3fff),
      positive(view.getUint16(28, true) & 0x3fff),
    );
  }
  if (chunk === 'VP8L') {
    const bits = view.getUint32(21, true);
    return facts('webp', positive((bits & 0x3fff) + 1), positive(((bits >> 14) & 0x3fff) + 1));
  }
  return { format: 'webp' };
}

function jpegFacts(b: Uint8Array): ImageFacts | undefined {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return undefined;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return { format: 'jpeg' };
    const marker = b[i + 1] ?? 0;
    // SOF0–SOF15 carry the frame size, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return facts('jpeg', positive(view.getUint16(i + 7)), positive(view.getUint16(i + 5)));
    }
    i += 2 + view.getUint16(i + 2);
  }
  return { format: 'jpeg' };
}

function svgLength(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = /^\s*([\d.]+)\s*(px)?\s*$/.exec(value);
  return match ? positive(Number(match[1])) : undefined;
}

function svgFacts(b: Uint8Array): ImageFacts | undefined {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(b);
  const tag = /<svg\b[^>]*>/i.exec(text)?.[0];
  if (!tag) return undefined;
  const attr = (name: string) =>
    new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1];
  let width = svgLength(attr('width'));
  let height = svgLength(attr('height'));
  const viewBox = attr('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if ((width === undefined || height === undefined) && viewBox?.length === 4) {
    width ??= positive(viewBox[2] ?? Number.NaN);
    height ??= positive(viewBox[3] ?? Number.NaN);
  }
  return facts('svg', width, height);
}

/**
 * Format and size from the leading bytes of an image. Returns only
 * what the bytes prove: `{}` when they match no known header.
 */
export function probeImageBytes(bytes: Uint8Array): ImageFacts {
  return (
    pngFacts(bytes) ??
    gifFacts(bytes) ??
    webpFacts(bytes) ??
    jpegFacts(bytes) ??
    svgFacts(bytes) ??
    {}
  );
}
