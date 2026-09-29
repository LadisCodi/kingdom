// The loading screen: `#boot` in index.html, painted before any script has
// arrived, lifted once the first screen has every image it shows.
//
// What the first screen shows is not listed anywhere — it is ASKED. The map
// requests its sprites as it draws (render/sprites.ts), and the DOM names its
// images in `<img>` tags and in the computed styles of what is mounted. The
// screen waits for those, decoded, then fades; everything else — the rest of
// the sprites, every image the stylesheets name for menus not yet open —
// loads behind it, a few at a time.

import { imageCounts, loadImage, preloadImages, requestedImagesSettled } from '../render/imageLoad';
import { preloadAllSprites } from '../render/sprites';

/** A lost request must never keep the player out of the game. */
const MAX_WAIT_MS = 20_000;
/** Enough passes for a sprite that arrives to pull in the ones it reveals. */
const MAX_PASSES = 4;
const FADE_MS = 350;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

function urlsIn(value: string, base: string, into: Set<string>): void {
  for (const m of value.matchAll(URL_RE)) {
    if (m[2].startsWith('data:')) continue;
    try { into.add(new URL(m[2], base).href); } catch { /* not a URL */ }
  }
}

/** Every image the mounted DOM is showing right now. */
function mountedImageUrls(): Set<string> {
  const urls = new Set<string>();
  const root = document.getElementById('app');
  if (!root) return urls;
  for (const img of root.querySelectorAll('img')) if (img.currentSrc || img.src) urls.add(img.currentSrc || img.src);
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const pseudo of [null, '::before', '::after']) {
      const cs = getComputedStyle(el, pseudo);
      for (const v of [cs.backgroundImage, cs.borderImageSource, cs.maskImage, cs.listStyleImage]) {
        if (v && v !== 'none') urlsIn(v, location.href, urls);
      }
    }
  }
  return urls;
}

/** Every image any stylesheet names — the menus not yet opened. */
function stylesheetImageUrls(): Set<string> {
  const urls = new Set<string>();
  const walk = (rules: CSSRuleList, base: string) => {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) urlsIn(rule.style.cssText, base, urls);
      if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules, base);
    }
  };
  for (const sheet of document.styleSheets) {
    try { walk(sheet.cssRules, sheet.href ?? location.href); } catch { /* cross-origin sheet */ }
  }
  return urls;
}

function setProgress(fraction: number): void {
  document.getElementById('boot')?.style.setProperty('--boot-progress', String(fraction));
}

/** Lift the loading screen now, without waiting for anything. */
export function dismissBootScreen(): void {
  const boot = document.getElementById('boot');
  if (!boot || boot.classList.contains('is-leaving')) return;
  setProgress(1);
  boot.classList.add('is-leaving');
  setTimeout(() => boot.remove(), FADE_MS);
}

/**
 * Hold the loading screen until the first screen's images are in, lift it,
 * then preload the rest. Call once the game is mounted and its render loop
 * is running.
 */
export async function revealWhenReady(): Promise<void> {
  let shown = 0;
  const progress = setInterval(() => {
    const { requested, settled } = imageCounts();
    // Never runs backwards: a new pass adds requests, not doubt.
    shown = Math.max(shown, requested === 0 ? 0 : settled / requested);
    setProgress(shown * 0.95);
  }, 100);

  const firstScreen = async () => {
    // Done when a drawn frame asks for nothing that has not already arrived.
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      await nextFrame();
      await nextFrame(); // one to draw, one to lay out what the draw changed
      for (const url of mountedImageUrls()) loadImage(url);
      const { requested, settled } = imageCounts();
      if (settled === requested) return;
      await requestedImagesSettled();
    }
  };
  await Promise.race([firstScreen(), delay(MAX_WAIT_MS)]);
  clearInterval(progress);
  dismissBootScreen();

  await preloadAllSprites();
  await preloadImages(stylesheetImageUrls());
}
