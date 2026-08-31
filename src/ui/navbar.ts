// Bottom navigation. The Build CTA lights when at least one uncapped district
// type is both affordable and has a legal cell (checked on every change).
// While an overlay is open the whole bar becomes a single Close button.

import type { Game } from '../game';
import { button } from './format';

export function mountNavbar(game: Game, root: HTMLElement): void {
  const toggle = (name: string) => () =>
    game.setOverlay(game.openOverlay === name ? null : name);

  const buildBtn = button('🔨 Build', toggle('build'));
  const spellsBtn = button('✨ Spells', toggle('spellbook'));
  const armyBtn = button('🛡️ Army', toggle('army'));
  const researchBtn = button('🔬 Research', toggle('research'));
  const closeBtn = button('✕ Close', () => game.setOverlay(null), 'close');

  const refresh = () => {
    buildBtn.classList.toggle('cta', game.buildCtaLit());
    if (game.openOverlay !== null) root.replaceChildren(closeBtn);
    else root.replaceChildren(buildBtn, spellsBtn, armyBtn, researchBtn);
  };
  game.onChange(refresh);
  refresh();
}
