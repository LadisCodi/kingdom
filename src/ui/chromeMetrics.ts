// The chrome measures ITSELF.
//
// `--hud-h` and `--nav-h` name the two bars every other screen positions
// against: `#panel` stops at `bottom: var(--nav-h)`, the research screen and
// the tools knob start at `top: var(--hud-h)`, the overlay pads by both. They
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
//
// `--quest-h` is the same idea for a widget rather than a bar: the toast slip
// and the quest scroll are both anchored above the nav, and stacking one over
// the other is only avoidable if the toast knows how tall the scroll is.

/** Measured to the nearest px — a fractional value makes `calc()` drift. */
function publish(name: string, px: number): void {
  document.documentElement.style.setProperty(name, `${Math.round(px)}px`);
}

/**
 * Watch the two chrome bars and the quest scroll, publishing their real
 * heights as CSS custom properties on :root. Idempotent per element; the
 * returned function stops watching (tests and teardown).
 */
export function watchChromeMetrics(els: {
  header: HTMLElement;
  navbar: HTMLElement;
  quest: HTMLElement;
}): () => void {
  const measure = () => {
    publish('--hud-h', els.header.offsetHeight);
    publish('--nav-h', els.navbar.offsetHeight);
    // A hidden quest scroll must publish 0, not its last height — `hidden`
    // leaves offsetHeight at 0 anyway, but the child is what actually carries
    // the box, so measure the mount point.
    publish('--quest-h', els.quest.offsetHeight);
  };

  // `ResizeObserver` fires once on observe, so the first measure is free.
  const ro = new ResizeObserver(measure);
  for (const el of [els.header, els.navbar, els.quest]) ro.observe(el);
  // The quest pill is swapped in and out rather than resized, and an element
  // going `hidden` is a resize to 0x0 — which the observer does report. What
  // it does NOT report is the mount point's child being replaced with one of
  // the same size, which is fine: same size, same variable.
  measure();
  return () => ro.disconnect();
}
