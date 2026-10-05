// Bottom navigation (§5.4): mockup M1's wooden bar of five tabs.
//
// It is the way into the menus from the MAP, so it leaves while one is open:
// it slides down out of the frame and back up when the map returns (nav.css,
// keyed on #overlay having content). Every sheet carries its own dismiss.
//
// And Settings has left the bar. It is a drawer you open twice a month
// sitting beside the thing you tap every session; giving it an equal tab
// flattened the hierarchy. It hangs from the header instead (header.ts).
// Three tabs also makes each one wider, which is the right direction for
// thumb reach.

import type { Game, OverlayName } from '../game';
import type { DoorId } from '../sim/doors';
import { el } from './format';
import { iconEl, setCta, type IconName } from './kit';
import { setAttr } from './domWrite';

// Army lost its tab. An army only matters at the moment it is SENT somewhere,
// so composition is set inside the expedition sheet and units are trained at
// the building that trains them — exactly as villagers are trained at the
// Townhall. The tab it vacated goes to the thing the player now visits every
// session: their relics.
//
// The store sits leftmost (Docs/features/14-monetization.md §2.1): the genre
// puts its shop at one end of the bar, and the Gems plaque in the header stays
// as the second door. Its mark is a market stall, and the Heroes' a knight's
// helmet — both drawn for the bar (sheets/ui-m2-nav.png).
//
// Heroes got a tab of their own on 2026-09-08, out of the Reliquary's second
// tab (Docs/features/10-heroes.md §8). A roster of thirty-two is a
// DESTINATION — the player goes to it to spend what a delve paid — and a
// destination reached by opening another screen and finding the right tab is
// one the design is hiding.
//
// ORDER, authored 2026-09-08: the collection tab sits in the middle, and
// Build takes the right edge — the end of the bar a right thumb reaches
// without moving, for the tab the player presses most.
//
// IT IS "RELICS", NOT "COLLECTION" (2026-09-15). The cards were never the
// destination: a player goes there to look at what their relics DO and to
// close the page that levels one. Naming the tab after the currency rather
// than after the thing it buys made the relics a screen behind a screen.
const TABS: ReadonlyArray<{ name: OverlayName; label: string; icon: IconName; door: DoorId }> = [
  { name: 'store', label: 'Store', icon: 'shop', door: 'store' },
  // The Bag (Docs/art/ui-inventory.md §3.1). It takes the Relics tab's
  // place once relics are found rather than collected; until then the bar
  // carries both.
  { name: 'bag', label: 'Bag', icon: 'chest', door: 'bag' },
  { name: 'collection', label: 'Relics', icon: 'relics', door: 'relics' },
  { name: 'heroes', label: 'Heroes', icon: 'helmet', door: 'heroes' },
  { name: 'research', label: 'Research', icon: 'research', door: 'research' },
  { name: 'build', label: 'Build', icon: 'build', door: 'build' },
];

export function mountNavbar(game: Game, root: HTMLElement): void {
  root.classList.add('nav');
  const tabs = TABS.map((t) => {
    const button = el(
      'button',
      { class: 'nav-tab', type: 'button', 'data-coach': `nav:${t.name}` },
      iconEl(t.icon, { size: 'md' }),
      el('span', { class: 'nav-label' }, t.label),
      // A shut door wears a brass padlock over its mark
      // (Docs/features/22-progression.md §3); it breaks off when it opens.
      el('span', { class: 'nav-lock', 'aria-hidden': 'true' }, iconEl('padlock', { size: 'sm' })),
    );
    // The bar is only on screen over the map, so a tap opens its menu — or,
    // behind a padlock, shakes it and says what opens it (setOverlay's gate).
    button.addEventListener('click', () => {
      if (!game.doorOpen(t.door)) {
        button.classList.remove('is-shaking');
        void button.offsetWidth; // restart the shake
        button.classList.add('is-shaking');
      }
      game.setOverlay(game.openOverlay === t.name ? null : t.name);
    });
    return { def: t, button };
  });
  root.replaceChildren(...tabs.map((t) => t.button));

  const refresh = () => {
    for (const { def, button } of tabs) {
      button.classList.toggle('is-active', game.openOverlay === def.name);
      const locked = !game.doorOpen(def.door);
      // The padlock breaks the moment the door opens: a class for one beat.
      if (button.classList.contains('is-locked') && !locked) {
        button.classList.add('is-unlocking');
        window.setTimeout(() => button.classList.remove('is-unlocking'), 900);
      }
      button.classList.toggle('is-locked', locked);
      setAttr(button, 'aria-disabled', locked ? 'true' : 'false');
      // Its name is hidden with its mark, so a reader hears only that it is shut.
      setAttr(button, 'aria-label', locked ? 'Locked' : def.label);
      // The orb shows when the screen behind the tab has
      // something the player can press right now: a district that is both
      // affordable and placeable, or a tech/upgrade that can be started
      // this second.
      const count = locked ? 0
        : def.name === 'build' ? game.buildCtaCount()
          : def.name === 'research' ? game.researchCtaCount()
            : def.name === 'bag' ? game.bagBadge()
              : 0;
      // The kit's orb, with the count on it past one (kit/cta.ts).
      setCta(button, count);
    }
  };
  game.onChange(refresh);
  refresh();
}
