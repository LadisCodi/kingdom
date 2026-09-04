// Bottom navigation, and the Settings knob that is deliberately not part of
// it (§5.4).
//
// Two changes from what this was.
//
// The bar no longer turns into a single Close button. That pattern was
// tidy — one cancel affordance for everything — but it meant the player
// could not go Build → Research without a detour through the map, and the
// nav vanishing under you is disorienting the first few times. Each sheet
// now carries its own dismiss instead, so the tabs can stay put.
//
// And Settings has left the bar. It is a drawer you open twice a month
// sitting beside the thing you tap every session; giving it an equal tab
// flattened the hierarchy. It becomes a floating knob under the header.
// Three tabs also makes each one wider, which is the right direction for
// thumb reach.

import type { Game, OverlayName } from '../game';
import { el } from './format';
import { iconEl, type IconName } from './kit';

// Army lost its tab. An army only matters at the moment it is SENT somewhere,
// so composition is set inside the expedition sheet and units are trained at
// the building that trains them — exactly as villagers are trained at the
// Townhall. The tab it vacated goes to the thing the player now visits every
// session: their relics.
//
// The store sits leftmost (Docs/features/14-monetization.md §2.1): the genre
// puts its shop at one end of the bar, and the Gems plaque in the header stays
// as the second door. It borrows the Gems icon rather than waiting on a
// storefront sprite — the atlas has no shop cell yet, and tests/icons.test.ts
// refuses an emoji stand-in.
const TABS: ReadonlyArray<{ name: OverlayName; label: string; icon: IconName }> = [
  { name: 'store', label: 'Store', icon: 'Gems' },
  { name: 'build', label: 'Build', icon: 'build' },
  { name: 'reliquary', label: 'Relics', icon: 'Mana' },
  { name: 'research', label: 'Research', icon: 'research' },
];

export function mountNavbar(game: Game, root: HTMLElement): void {
  root.classList.add('nav');
  const tabs = TABS.map((t) => {
    const button = el(
      'button',
      { class: 'nav-tab', type: 'button' },
      iconEl(t.icon, { size: 'md' }),
      el('span', { class: 'nav-label' }, t.label),
    );
    // Tapping the open tab closes it; tapping another switches straight to
    // it, which is the whole point of keeping the bar on screen.
    button.addEventListener('click', () => {
      game.setOverlay(game.openOverlay === t.name ? null : t.name);
    });
    return { def: t, button };
  });
  root.replaceChildren(...tabs.map((t) => t.button));

  const refresh = () => {
    for (const { def, button } of tabs) {
      button.classList.toggle('is-active', game.openOverlay === def.name);
      // The CTA lights when the screen behind the tab has something the
      // player can press right now: a district that is both affordable and
      // placeable, or a tech/upgrade that can be started this second.
      const cta = def.name === 'build' ? game.buildCtaLit()
        : def.name === 'research' ? game.researchCtaLit()
          : false;
      button.classList.toggle('is-cta', cta);
    }
  };
  game.onChange(refresh);
  refresh();
}

/** The floating Settings knob, mounted outside the header (#tools). */
export function mountTools(game: Game, root: HTMLElement): void {
  const button = el('button', {
    class: 'tools-knob', type: 'button', 'aria-label': 'Settings',
  }, iconEl('settings', { size: 'md' }));
  button.addEventListener('click', () => {
    game.setOverlay(game.openOverlay === 'settings' ? null : 'settings');
  });
  root.replaceChildren(button);

  const refresh = () => button.classList.toggle('is-active', game.openOverlay === 'settings');
  game.onChange(refresh);
  refresh();
}
