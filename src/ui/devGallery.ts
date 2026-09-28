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

/** The chrome's own art, by file stem.
 *
 * Through `import.meta.glob`, not as a literal path: these go into inline
 * `style` attributes, which Vite does not rewrite, so a written-out
 * `/src/ui/assets/x.png` renders in dev and 404s in the build. The same
 * trick `src/render/sprites.ts` uses for map art. */
const MATERIAL: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob('./assets/*.{png,jpg}', { eager: true, query: '?url', import: 'default' }),
  ).map(([path, url]) => [path.replace(/^.*\/|\.[a-z]+$/g, ''), url as string]),
);
const mat = (stem: string): string => MATERIAL[stem] ?? '';

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
    ),
    // §6.4: a price lives INSIDE the button that spends it, and a term the
    // player cannot pay turns clay — which is itself the reason the button is
    // dead, so these need no words beside them.
    el('div', { class: 'gal-row' },
      specimen('cost, affordable', btn({
        label: 'Upgrade', kind: 'primary', onClick: noop,
        cost: { Gold: 123, Food: 43 }, have: () => 999,
      })),
      specimen('cost, priced out', btn({
        label: 'Upgrade', kind: 'primary', onClick: noop,
        cost: { Gold: 123, Food: 43 }, have: (c) => (c === 'Gold' ? 999 : 12),
      })),
      specimen('one term', btn({
        label: 'Call', kind: 'gem', onClick: noop,
        cost: { Gems: 30 }, have: () => 4,
      })),
      specimen('non-wallet cost', btn({
        label: 'Raise its tier', onClick: noop,
        costExtra: [{ icon: 'sparkle', amount: '3 / 20', short: true }],
      })),
      specimen('knob −', knob('−', noop, { label: 'Remove worker' })),
      specimen('knob +', knob('+', noop, { label: 'Add worker' })),
      specimen('knob at limit', knob('+', noop, { label: 'Add worker', disabled: true })),
    ),
    // The rule §6.3 makes universal: never greyed out without a reason.
    specimen('priced, with a consequence beside it', action({
      label: 'Upgrade', kind: 'primary', onClick: noop,
      cost: { Wood: 40, Stone: 20 }, have: () => 999,
      info: 'takes 2m 30s',
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
      card({ icon: 'Sanctum', name: 'Sanctum', desc: 'Holds the city\'s Mana', locked: true },
        el('div', {}, iconEl('padlock', { size: 'sm' }))),
    )),
    specimen('sheet', sheet({ title: 'Sanctum', onClose: noop },
      el('p', {}, 'A bottom sheet: grab handle, titled plank, its own close knob.'))),
    // The three it can also be. These are the REAL sheet() with its flags set,
    // not a drawing of one, so a change to the primitive shows here by itself.
    specimen('sheet — centred (the modal one)', sheet(
      { title: 'Finish now?', onClose: noop, centred: true },
      el('p', {}, 'For a short, one-decision sheet: an offer, a confirmation.'),
    )),
    specimen('sheet — plankless', sheet(
      { title: 'Hero', onClose: noop, bare: true },
      el('p', {}, 'The content already names it, so the plank would say it twice.'),
    )),
  ));

  // ---- materials -------------------------------------------------------
  // The 9-SLICE, which is the one thing a screenshot of a finished screen
  // cannot check. A frame is cut once and then stretched by whatever sits in
  // it, so what has to be seen is the SAME piece at sizes that fight it: a box
  // tighter than the slice, a wide strip, a tall column. A wrong slice number
  // shows as a corner that smears or an edge that repeats mid-run — never in
  // the comfortable middle size a mockup happens to use.
  //
  // Named by the CSS class that draws them, so a fault here points at a line
  // in material.css rather than at "the panels".
  const SLICES: ReadonlyArray<{ name: string; css: string; used: string }> = [
    {
      name: 'frame-wood 80 / 12px round',
      css: `border:9px solid transparent;border-image:url('${mat('frame-wood')}') 80 / 12px / 2px round;`
        + `background:url('${mat('tex-parchment')}') padding-box 0 0 / 384px 384px;`,
      used: '.k-panel · .dc',
    },
    {
      name: 'plate-wood 44 fill / 10px',
      css: "border:10px solid transparent;"
        + `border-image:url('${mat('plate-wood')}') 44 fill / 10px stretch;`,
      used: '.hud-coins · .nav-tab · .res-tome',
    },
    {
      name: 'plate-parchment 64 fill / 16px round',
      css: "border:16px solid transparent;"
        + `border-image:url('${mat('plate-parchment')}') 64 fill / 16px round;`,
      used: '.hud-plaque · .dly-pill · .q-scroll',
    },
  ];
  // Four shapes, and the first is the cruel one: 44px of box for a 12px slice
  // on each side leaves 20px of middle, which is where a frame drawn as a
  // picture rather than as nine pieces falls apart.
  const SHAPES: ReadonlyArray<[string, string]> = [
    ['44 square — tighter than the slice', 'width:44px;height:44px'],
    ['120 x 44', 'width:120px;height:44px'],
    ['320 x 56 — a wide run', 'width:320px;height:56px'],
    ['120 x 220 — a tall run', 'width:120px;height:220px'],
  ];
  page.append(section(
    'Materials — the nine-slice at sizes that fight it',
    ...SLICES.map((sl) => el('div', { class: 'gal-slice' },
      el('div', { class: 'gal-label' }, `${sl.name}  ·  ${sl.used}`),
      el('div', { class: 'gal-row' },
        ...SHAPES.map(([label, box]) => specimen(
          label,
          el('div', { class: 'gal-box', style: `${box};${sl.css}` }),
        )),
      ))),
    el('div', { class: 'gal-label' }, 'textures — tiled, at the size the CSS asks for'),
    el('div', { class: 'gal-row' },
      specimen('tex-wood 512', el('div', {
        class: 'gal-box',
        style: `width:220px;height:120px;background:url('${mat('tex-wood')}') center / 512px 512px`,
      })),
      specimen('tex-parchment 384', el('div', {
        class: 'gal-box',
        style: `width:220px;height:120px;background:url('${mat('tex-parchment')}') 0 0 / 384px 384px`,
      })),
      specimen('beam-wood, repeat-x', el('div', {
        class: 'gal-box',
        style: `width:320px;height:48px;background:url('${mat('beam-wood')}') center / auto 100% repeat-x`,
      })),
    ),
  ));

  // ---- decorations -----------------------------------------------------
  // The pieces material.css hangs on a surface rather than builds it from.
  // They are drawn at a fixed size and never stretched, so what matters here
  // is only that each one is the right thing and reads on both grounds.
  const deco = (file: string, w: number, h: number) => el('div', {
    class: 'gal-box gal-box--bare',
    style: `width:${w}px;height:${h}px;`
      + `background:url('${mat(file)}') center / contain no-repeat`,
  });
  page.append(section(
    'Decorations',
    el('div', { class: 'gal-row' },
      specimen('rope (grab)', deco('deco-rope', 96, 28)),
      specimen('rope, vertical', deco('deco-rope-v', 24, 96)),
      specimen('nail', deco('deco-nail', 20, 20)),
      specimen('knob', deco('deco-knob', 44, 44)),
      specimen('pennant', deco('deco-pennant', 40, 48)),
      specimen('seal', deco('deco-seal', 48, 48)),
    ),
    el('div', { class: 'gal-label' }, 'tech seals — the four states a card walks through'),
    el('div', { class: 'gal-row' },
      specimen('plain', deco('seal-plain', 56, 56)),
      specimen('available', deco('seal-available', 56, 56)),
      specimen('active', deco('seal-active', 56, 56)),
      specimen('done', deco('seal-done', 56, 56)),
    ),
    el('div', { class: 'gal-label' }, 'settings marks'),
    el('div', { class: 'gal-row' },
      ...['set-music', 'set-sfx', 'set-ambience', 'set-save', 'set-payer'].map((f) =>
        specimen(f.slice(4), deco(f, 44, 44))),
    ),
  ));

  // ---- the phone frame -------------------------------------------------
  // Density is judged HERE, in one place: the header, a sheet at its cap and
  // the nav, at the iPhone's 402×874, with a 44px ruler beside them. A kit
  // primitive that looks fine on its own can still eat the screen in a row.
  const phone = (width: number, height: number, ...body: HTMLElement[]) => {
    const frame = el('div', { class: 'gal-phone', style: `width:${width}px;height:${height}px` });
    frame.append(...body);
    return frame;
  };
  const fakeHeader = () => el('div', { class: 'gal-phone-hud' },
    el('span', { class: 'hud-coin' }, iconEl('Gold', { size: 'sm' }), '1,240'),
    el('span', { class: 'hud-coin' }, iconEl('Food', { size: 'sm' }), '86'),
    el('span', { class: 'hud-coin' }, iconEl('Wood', { size: 'sm' }), '312'),
    el('span', { class: 'hud-coin' }, iconEl('Stone', { size: 'sm' }), '40'),
    el('span', { class: 'hud-coin hud-gems' }, iconEl('Gems', { size: 'sm' }), '10'));
  const fakeNav = () => el('div', { class: 'gal-phone-nav' },
    ...(['Gems', 'relics', 'Warrior', 'research', 'build'] as IconName[]).map((n, i) =>
      el('span', { class: `nav-tab${i === 4 ? ' is-cta' : ''}` }, iconEl(n),
        el('span', { class: 'nav-label' }, ['Store', 'Relics', 'Heroes', 'Research', 'Build'][i]))));
  const fakeSheet = () => el('div', { class: 'gal-phone-sheet' }, sheet(
    { title: 'Build', onClose: noop },
    grid(
      card({ icon: 'Housing', name: 'Cottage', desc: 'Homes for your villagers' }, costChips({ Wood: 20, Stone: 10 })),
      card({ icon: 'Farm', name: 'Wheat farm', desc: 'Grows food' }, costChips({ Wood: 30, Stone: 10 })),
      card({ icon: 'Sawmill', name: 'Sawmill', desc: 'Turns trees into timber' }, costChips({ Wood: 40, Stone: 20 })),
    ),
    action({ label: 'Upgrade', kind: 'primary', onClick: noop, cost: { Wood: 40, Stone: 20 }, have: () => 999 }),
  ));
  const ruler = el('div', { class: 'gal-ruler' },
    el('div', { class: 'gal-ruler-tick' }, '44'),
    el('div', { class: 'gal-ruler-tick' }, '44'),
    el('div', { class: 'gal-ruler-tick' }, '44'));
  // THREE widths, not one. The kit is judged at 402 because that is the phone
  // the mockups were drawn for, but every layout fault this project has had
  // lived at the ends: the header wraps to two rows below 426, and 375 is the
  // narrowest phone still sold. A specimen that only exists at 402 is a
  // specimen that cannot fail.
  const WIDTHS = [375, 402, 426] as const;
  page.append(section(
    'Phone frame — header 44 · sheet ≤70% · nav 52',
    el('div', { class: 'gal-row' },
      ...WIDTHS.map((w) => specimen(
        `${w}px`,
        phone(w, 874, fakeHeader(), fakeSheet(), fakeNav()),
      )),
      specimen('44px ruler', ruler),
    ),
  ));

  // ---- icons on every ground -----------------------------------------
  // Every name the kit can ask for. `tests/icons.test.ts` already proves each
  // one has a cell; what this page is for is the thing a test cannot see —
  // whether it READS, on the three grounds it actually sits on.
  const names = Object.keys(ICON_EMOJI) as IconName[];
  const iconRow = (ground: string, cls: string) => el(
    'div',
    { class: `gal-icons ${cls}` },
    el('div', { class: 'gal-label' }, ground),
    ...names.map((n) => iconEl(n, { size: 'md' })),
  );
  page.append(section(
    `Icons (${names.length})`,
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
