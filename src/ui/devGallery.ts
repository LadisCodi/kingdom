// The kit gallery: every primitive, in every state, on one page (`?dev=kit`).
//
// Two jobs. It is the reference to hold next to the §7.1 mockup while the
// materials are still being tuned; and it is where a style leak shows up
// once, instead of being discovered screen by screen over the next month —
// notably anything still inheriting from src/style.css.
//
// Not shipped to players: mounted only behind the ?dev flag.

import { el } from './format';
import {
  action, btn, card, chip, costChips, grid, iconEl, knob, meter, panel, pips,
  plank, progress, sheet, stat, switchCtl, toggleGroup, ICON_EMOJI,
  type IconName,
} from './kit';

const section = (title: string, ...children: Array<Node | string>): HTMLElement =>
  el('section', { class: 'gal-section' }, el('h2', {}, title), ...children);

/** A labelled specimen, so a broken one is identifiable at a glance. */
const specimen = (label: string, node: Node): HTMLElement =>
  el('div', { class: 'gal-item' }, el('div', { class: 'gal-label' }, label), node);

export function mountGallery(root: HTMLElement): void {
  const page = el('div', { class: 'gal' });

  // ---- buttons -------------------------------------------------------
  const noop = () => {};
  page.append(section(
    'Buttons',
    el('div', { class: 'gal-row' },
      specimen('primary', btn({ label: 'Build', onClick: noop, kind: 'primary' })),
      specimen('secondary', btn({ label: 'Select', onClick: noop })),
      specimen('destructive', btn({ label: 'Reset', onClick: noop, kind: 'destructive' })),
      specimen('gem', btn({ label: 'Finish', onClick: noop, kind: 'gem', icon: 'Gems' })),
      specimen('with icon', btn({ label: 'Show me', onClick: noop, icon: 'showme' })),
      specimen('knob −', knob('−', noop, { label: 'Remove worker' })),
      specimen('knob +', knob('+', noop, { label: 'Add worker' })),
      specimen('knob at limit', knob('+', noop, { label: 'Add worker', disabled: true })),
    ),
    // The rule §6.3 makes universal: never greyed out without a reason.
    specimen('available', action({
      label: 'Upgrade', kind: 'primary', onClick: noop,
      info: costChips({ Wood: 40, Stone: 20 }),
    })),
    specimen('gated', action({
      label: 'Upgrade', kind: 'primary', onClick: noop,
      disabledReason: 'Your Townhall must reach level 3',
    })),
    specimen('gated (research)', action({
      label: 'Recruit', onClick: noop,
      disabledReason: 'Research Bronze Working first',
    })),
  ));

  // ---- switches and toggles -------------------------------------------
  let toggleValue: number | 'All' = 10;
  const toggles = el('div', {});
  const renderToggles = () => {
    toggles.replaceChildren(toggleGroup(
      [
        { label: 'x1', value: 1 as number | 'All' },
        { label: 'x10', value: 10 as number | 'All' },
        { label: 'x100', value: 100 as number | 'All' },
        { label: 'x1,000', value: 1000 as number | 'All' },
        { label: 'All', value: 'All' as number | 'All' },
      ],
      toggleValue,
      (v) => { toggleValue = v; renderToggles(); },
    ));
  };
  renderToggles();
  let musicOn = true;
  const sw = el('div', {});
  const renderSwitch = () => {
    sw.replaceChildren(switchCtl(musicOn, () => { musicOn = !musicOn; renderSwitch(); }, 'Music'));
  };
  renderSwitch();
  page.append(section(
    'Switches & toggles',
    el('div', { class: 'gal-row' },
      specimen('switch (live)', sw),
      specimen('switch off', switchCtl(false, noop, 'Ambience')),
    ),
    specimen('segmented (live)', toggles),
  ));

  // ---- stats ----------------------------------------------------------
  const p1 = progress('leaf');
  p1.set(0.66, '6/10');
  const p2 = progress('sky');
  p2.set(0.3, '1m 20s left');
  const p3 = progress('gold');
  p3.set(1, 'complete');
  page.append(section(
    'Read-outs',
    el('div', { class: 'gal-row' },
      specimen('chip', chip('Wood', 20)),
      specimen('chip (short)', chip('Stone', 40, true)),
      specimen('cost', costChips({ Wood: 20, Stone: 10, Gold: 150 })),
      specimen('cost (unaffordable)', costChips({ Wood: 20, Stone: 999 }, () => 30)),
      specimen('free', costChips({})),
    ),
    el('div', { class: 'gal-row' },
      specimen('stat', stat('Gold', '1.5', 'per minute')),
      specimen('stat', stat('Wood', '+3', 'every 11s')),
      specimen('pips 3/5', pips(3, 5)),
      specimen('pips 0/4', pips(0, 4)),
      specimen('meter 6/20', meter(6, 20)),
    ),
    specimen('progress — leaf', p1.root),
    specimen('progress — sky', p2.root),
    specimen('progress — gold', p3.root),
  ));

  // ---- surfaces -------------------------------------------------------
  page.append(section(
    'Surfaces',
    specimen('panel + plank', panel(
      plank('Build'),
      el('p', {}, 'A parchment panel inside a carved wooden frame.'),
    )),
    specimen('cards', grid(
      card({ icon: 'Housing', name: 'Housing', desc: 'Villagers live here and pay taxes' },
        el('div', {}, costChips({ Wood: 20 }))),
      card({ icon: 'Market', name: 'Market', desc: 'Trade surplus for Gold', locked: true },
        el('div', {}, iconEl('padlock', { size: 'sm' }))),
    )),
    specimen('sheet', sheet({ title: 'Market', onClose: noop },
      el('p', {}, 'A bottom sheet: grab handle, titled plank, its own close knob.'))),
  ));

  // ---- icons on every ground -----------------------------------------
  const names = Object.keys(ICON_EMOJI) as IconName[];
  const iconRow = (ground: string, cls: string) => el(
    'div',
    { class: `gal-icons ${cls}` },
    el('div', { class: 'gal-label' }, ground),
    ...names.map((n) => iconEl(n, { size: 'md' })),
  );
  page.append(section(
    `Icons (${names.length}) — emoji fallback until the atlas lands`,
    // An icon that reads on parchment can vanish on wood; check both.
    iconRow('on parchment', 'on-parchment'),
    iconRow('on wood', 'on-wood'),
    iconRow('on grass', 'on-grass'),
    el('div', { class: 'gal-row' },
      specimen('sm / md / lg', el('span', {},
        iconEl('Gold', { size: 'sm' }), iconEl('Gold'), iconEl('Gold', { size: 'lg' }))),
      specimen('locked', el('span', {},
        iconEl('Quarry'), iconEl('Quarry', { locked: true }))),
    ),
  ));

  root.replaceChildren(page);
}
