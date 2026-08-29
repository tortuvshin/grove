// One-time generator for the raster social/PWA assets committed under
// public/. Run manually from apps/docs (`node scripts/generate-social-assets.mjs`)
// whenever og-image.svg or the logo mark changes, inspect the output, and
// commit the PNGs. This is intentionally NOT a build step: og-image.svg
// renders text with system font stacks, so rasterizing on the deploy image
// would produce different (and unreviewed) output than rasterizing here.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const pub = (p) => new URL(`../public/${p}`, import.meta.url).pathname;

const ACCENT = '#7dd3d8';
const BACKGROUND = '#091116';

// The logo mark draws with `currentColor`, which librsvg rasterizes as
// black. Re-color it and (optionally) put it on a solid rounded tile so
// touch icons and maskable icons are never transparent.
const logoSvg = (
  await readFile(new URL('../src/assets/logo.svg', import.meta.url), 'utf8')
).replace(/currentColor/g, ACCENT);

function tile({ size, pad, radius, background }) {
  const inner = size - pad * 2;
  const logo = logoSvg
    .replace(/width="32"/, `width="${inner}"`)
    .replace(/height="32"/, `height="${inner}"`);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      (background
        ? `<rect width="${size}" height="${size}" rx="${radius}" fill="${background}"/>`
        : '') +
      `<g transform="translate(${pad}, ${pad})">${logo}</g>` +
      `</svg>`,
  );
}

// Rasterize at high density for crisp text/strokes, then resize down to
// the exact target dimensions.
async function writePng(input, out, width, height) {
  await sharp(input, { density: 300 }).resize(width, height).png().toFile(pub(out));
  const meta = await sharp(pub(out)).metadata();
  console.log(`${out}: ${meta.width}x${meta.height}`);
}

// 1. OG card: rasterize the existing 1200×630 SVG as-is.
await writePng(pub('og-image.svg'), 'og-image.png', 1200, 630);

// 2. Apple touch icon: 180×180, solid background (iOS ignores alpha),
//    no rounding — iOS applies its own mask.
await writePng(
  tile({ size: 180, pad: 28, radius: 0, background: BACKGROUND }),
  'apple-touch-icon.png',
  180,
  180,
);

// 3. PWA icons.
await writePng(
  tile({ size: 192, pad: 24, radius: 36, background: BACKGROUND }),
  'icons/icon-192.png',
  192,
  192,
);
await writePng(
  tile({ size: 512, pad: 64, radius: 96, background: BACKGROUND }),
  'icons/icon-512.png',
  512,
  512,
);
// Maskable: logo confined to the central ~80% safe zone, full-bleed bg.
await writePng(
  tile({ size: 512, pad: 112, radius: 0, background: BACKGROUND }),
  'icons/icon-512-maskable.png',
  512,
  512,
);

// 4. Square Organization logo for schema.org (Google wants ≥112px raster).
await writePng(
  tile({ size: 512, pad: 80, radius: 0, background: BACKGROUND }),
  'logo.png',
  512,
  512,
);
