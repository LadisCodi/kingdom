// Bottom navigation. The Build CTA lights when at least one uncapped district
// type is both affordable and has a legal cell (checked on every change).
// While anything dismissible is on screen (overlay, placement, district card)
// the whole bar becomes a single Close button — the one cancel/close
// affordance for every menu.

import type { Game } from '../game';
import { button } from './format';

export function mountNavbar(game: Game, root: HTMLElement): void {
  const toggle = (name: string) => () =>
    game.setOverlay(game.openOverlay === name ? null : name);

  const buildBtn = button('🔨 Build', toggle('build'));
  const marketBtn = button('🛒 Market', toggle('market'));
  const armyBtn = button('🛡️ Army', toggle('army'));
  const researchBtn = button('🔬 Research', toggle('research'));
  const closeBtn = button('✕ Close', () => game.dismiss(), 'close');

  const refresh = () => {
    buildBtn.classList.toggle('cta', game.buildCtaLit());
    if (game.dismissible()) root.replaceChildren(closeBtn);
    else root.replaceChildren(buildBtn, marketBtn, armyBtn, researchBtn);
  };
  game.onChange(refresh);
  refresh();
}
