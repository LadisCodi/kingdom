// Bottom navigation. The Build CTA lights when at least one uncapped district
// type is both affordable and has a legal cell (checked on every change).

import type { Game } from '../game';
import { button } from './format';

export function mountNavbar(game: Game, root: HTMLElement): void {
  const toggle = (name: string) => () =>
    game.setOverlay(game.openOverlay === name ? null : name);

  const buildBtn = button('🔨 Build', toggle('build'));
  const spellsBtn = button('✨ Spells', toggle('spellbook'));
  const armyBtn = button('🛡️ Army', toggle('army'));
  const researchBtn = button('🔬 Research', toggle('research'));
  root.append(buildBtn, spellsBtn, armyBtn, researchBtn);

  const refresh = () => {
    buildBtn.classList.toggle('cta', game.buildCtaLit());
  };
  game.onChange(refresh);
  refresh();
}
