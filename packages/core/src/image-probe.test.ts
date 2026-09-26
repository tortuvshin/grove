import { describe, expect, it } from 'vitest';
import { imageFormatFromPath, probeImageBytes } from './image-probe.js';

function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(b.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return b;
}

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

describe('probeImageBytes', () => {
  it('reads PNG dimensions from the IHDR chunk', () => {
    expect(probeImageBytes(png(512, 256))).toEqual({ format: 'png', width: 512, height: 256 });
  });

  it('reads GIF dimensions', () => {
    const b = new Uint8Array(13);
    b.set(text('GIF89a'));
    new DataView(b.buffer).setUint16(6, 40, true);
    new DataView(b.buffer).setUint16(8, 30, true);
    expect(probeImageBytes(b)).toEqual({ format: 'gif', width: 40, height: 30 });
  });

  it('reads extended WebP (VP8X) dimensions', () => {
    const b = new Uint8Array(30);
    b.set(text('RIFF'), 0);
    b.set(text('WEBP'), 8);
    b.set(text('VP8X'), 12);
    // Canvas width-1 and height-1 as 24-bit little-endian values.
    b.set([0xff, 0x03, 0x00], 24); // 1023 → 1024
    b.set([0xff, 0x01, 0x00], 27); // 511 → 512
    expect(probeImageBytes(b)).toEqual({ format: 'webp', width: 1024, height: 512 });
  });

  it('finds the JPEG frame header after other segments', () => {
    const b = new Uint8Array([
      0xff,
      0xd8, // SOI
      0xff,
      0xe0,
      0x00,
      0x04,
      0x00,
      0x00, // APP0, length 4
      0xff,
      0xc0,
      0x00,
      0x11,
      0x08,
      0x02,
      0xd0,
      0x05,
      0x00,
      0x03, // SOF0: 720 × 1280
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ]);
    expect(probeImageBytes(b)).toEqual({ format: 'jpeg', width: 1280, height: 720 });
  });

  it('reads SVG width/height, falling back to the viewBox', () => {
    expect(probeImageBytes(text('<svg xmlns="x" width="64px" height="32">'))).toEqual({
      format: 'svg',
      width: 64,
      height: 32,
    });
    expect(
      probeImageBytes(text('<?xml version="1.0"?><svg viewBox="0 0 1024 768"></svg>')),
    ).toEqual({ format: 'svg', width: 1024, height: 768 });
    // Relative units are not pixel sizes.
    expect(probeImageBytes(text('<svg width="100%" height="100%">'))).toEqual({ format: 'svg' });
  });

  it('returns nothing for bytes it does not recognise', () => {
    expect(probeImageBytes(text('version https://git-lfs.github.com/spec/v1'))).toEqual({});
    expect(probeImageBytes(new Uint8Array(0))).toEqual({});
  });
});

describe('imageFormatFromPath', () => {
  it('maps extensions and ignores query strings', () => {
    expect(imageFormatFromPath('a/b/icon.PNG')).toBe('png');
    expect(imageFormatFromPath('https://x.test/shot.jpg?raw=true')).toBe('jpeg');
    expect(imageFormatFromPath('logo')).toBeUndefined();
  });
});
