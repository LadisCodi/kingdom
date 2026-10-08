// The chrome measures ITSELF.
//
// `--hud-h` and `--nav-h` name the two bars every other screen positions
// against: `#panel` stops at `bottom: var(--nav-h)`, the research screen
// starts at `top: var(--hud-h)`, the overlay pads by both. They
// were hand-written constants, and both were wrong — the header renders 59px
// against a declared 78, and the nav bar renders 84 against a declared 68,
// because a `min-height` is a floor and its content had grown past it.
//
// Sixteen pixels of the district card and the quest scroll were therefore
// UNDER the nav bar, and nineteen pixels of sky sat between the header and
// everything that claimed to hang off it. Neither is visible in the CSS: each
// rule reads correctly, and the constant it trusts is the lie.
//
// So the numbers come from the elements now. A ResizeObserver writes the real
// heights onto :root, the tokens stay as the pre-paint fallback, and a bar
// that changes height — the builders plaque appearing, a safe-area inset on a
// notched phone, a font that loads late — moves every screen with it instead
// of silently overlapping five of them.

/** Measured to the nearest px — a fractional value makes `calc()` drift. */
function publish(name: string, px: number): void {
  document.documentElement.style.setProperty(name, `${Math.round(px)}px`);
}

/**
 * Watch the two chrome bars, publishing their real
 * heights as CSS custom properties on :root. Idempotent per element; the
 * returned function stops watching (tests and teardown).
 */
export function watchChromeMetrics(els: {
  header: HTMLElement;
  navbar: HTMLElement;
}): () => void {
  const measure = () => {
    publish('--hud-h', els.header.offsetHeight);
    publish('--nav-h', els.navbar.offsetHeight);
  };

  // `ResizeObserver` fires once on observe, so the first measure is free.
  const ro = new ResizeObserver(measure);
  for (const el of [els.header, els.navbar]) ro.observe(el);
  measure();
  return () => ro.disconnect();
}
