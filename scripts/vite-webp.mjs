// Build only: every PNG the bundle emits ships as WebP.
//
// The PNGs in the repo stay the source of truth — the art scripts read and
// write them, and the dev server serves them as they are. At build time each
// emitted `.png` asset is re-encoded, renamed with a hash of its new bytes,
// and every reference to it (JS, CSS, HTML) is rewritten. The hashed
// basename is unique, so a plain string replace cannot hit anything else.
//
// Art goes lossy at a high quality with the alpha kept exact. An ATLAS is
// sampled cell by cell — lossy chroma would bleed across the cell edges —
// so atlases go near-lossless. Encodes are cached by source hash under
// node_modules/.cache, so a rebuild only pays for the art that changed.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const LOSSY = { quality: 90, alphaQuality: 100, smartSubsample: true, effort: 6 };
const NEAR_LOSSLESS = { nearLossless: true, quality: 60, effort: 6 };
const isAtlas = (name) => /(^|[-_/])atlas([-_.]|$)/.test(name);

const CACHE_DIR = path.resolve('node_modules/.cache/webp');
const SETTINGS = JSON.stringify({ LOSSY, NEAR_LOSSLESS, v: 3 });

async function encode(source, name) {
  const key = createHash('sha256').update(SETTINGS).update(String(isAtlas(name))).update(source).digest('hex');
  const cached = path.join(CACHE_DIR, `${key}.webp`);
  try {
    return fs.readFileSync(cached);
  } catch {
    const out = await sharp(source).webp(isAtlas(name) ? NEAR_LOSSLESS : LOSSY).toBuffer();
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cached, out);
    return out;
  }
}

export function webpPlugin() {
  return {
    name: 'kingdom-webp',
    apply: 'build',
    enforce: 'post',
    async generateBundle(_options, bundle) {
      const renames = new Map(); // old basename → new basename
      await Promise.all(Object.values(bundle).map(async (file) => {
        if (file.type !== 'asset' || !file.fileName.endsWith('.png')) return;
        const png = Buffer.from(file.source);
        const webp = await encode(png, file.fileName);
        if (webp.length >= png.length) return; // never ship a bigger file
        const hash = createHash('sha256').update(webp).digest('base64url').slice(0, 8);
        const fileName = file.fileName.replace(/-[\w-]{8}\.png$|\.png$/, `-${hash}.webp`);
        delete bundle[file.fileName];
        this.emitFile({ type: 'asset', fileName, source: webp });
        renames.set(path.basename(file.fileName), path.basename(fileName));
      }));
      if (renames.size === 0) return;
      const rewrite = (text) => {
        for (const [from, to] of renames) text = text.replaceAll(from, to);
        return text;
      };
      for (const file of Object.values(bundle)) {
        if (file.type === 'chunk') file.code = rewrite(file.code);
        else if (/\.(css|html|js)$/.test(file.fileName) && typeof file.source === 'string') {
          file.source = rewrite(file.source);
        }
      }
    },
  };
}
