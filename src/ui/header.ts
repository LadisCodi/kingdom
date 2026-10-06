// The resource HUD: a wooden plank of coins, and one plaque hanging under it.
//
// What changed and why (§5.1). This was nine widgets of equal weight —
// Gold, Food, Wood, Stone, Iron, Gems, population, builders, free workers,
// plus a save-mode badge — wrapping onto two rows on a phone, so none of
// them read. The currency pass since cut the wallet from eleven rows to
// seven: berries, game and shoals pay Food and veins pay Stone, so the coins
// the plank can ever hold are Gold, Food, Wood and Stone. Stardust and
// Knowledge are off it too — each is spent in exactly one screen, so each
// reads in that screen's header instead. Now:
//
//   * three coins that gate the early game, with Stone appearing only once
//     it means something — and the whole set SWAPS on a screen that spends
//     something else: the roster shows Hero XP and Stardust instead, because
//     neither is on any plank and the city's four buy nothing there;
//   * MANA, then Gems past the rope. Mana is the energy every tap is paid
//     from, so it is never hidden and never contextual — a player who cannot
//     see it cannot tell why a tap just refused;
//   * POPULATION is not here at all. It lives on the world, over the
//     Townhall, which is where villagers are trained and therefore where a
//     player looks when they want more of them. The header is for things you
//     spend from anywhere; population is a property of one building;
//   * the plaque under the plank keeps only the CONTEXTUAL read-outs
//     (workers while staffing, builders while building, the army cap while
//     looking at a hall that trains soldiers);
//   * KNOWLEDGE, in a tab of its own hanging under the plank's middle (M33):
//     the bar that paces the whole game, so it is always in sight on the map
//     — what is held, ten segments, and a caption taking turns between the
//     next point and the full bar. It steps aside while a menu is open, like
//     the Settings knob, and the Research book carries it on the plank;
//   * the save badge moved to Settings, where it belongs.
//
// The presenter decides all of it (visibleCurrencies, hudSlot) — this file
// only draws.

import type { Game } from '../game';
import type { CurrencyId } from '../sim/state';
import { el, formatCount } from './format';
import { heldOf, onHoldChange } from './hudHold';
import { setAttr, setStyle, setText } from './domWrite';
import { currencyIcon, iconEl, setCta } from './kit';

/** What the plaque shows, per kind. */
const SLOT_ICON = {
  population: 'population', workers: 'workers', builders: 'builders', army: 'army',
} as const;
const SLOT_LABEL = {
  population: 'Population', workers: 'Free villagers', builders: 'Builders free',
  army: 'Army',
} as const;

export function mountHeader(game: Game, root: HTMLElement): void {
  root.classList.add('hud');
  const plank = el('div', { class: 'hud-plank' });
  const coins = el('div', { class: 'hud-coins' });
  const gems = el('button', { class: 'hud-slot hud-gems', type: 'button', 'aria-label': 'Gems' });
  const plaque = el('button', { class: 'hud-plaque', type: 'button', 'data-coach': 'builders' });

  // THE KNOWLEDGE TAB (M33). Straight on the painted wood: the book, the
  // number, ten segments and a caption under them; the + opens the sheet,
  // and so does the rest of the tab.
  const knowTab = el('button', {
    class: 'hud-know', type: 'button', 'aria-label': 'Knowledge', 'data-coach': 'knowledge',
  });
  const knowValue = el('b', { class: 'hud-know-value' }, '0');
  const segments = el('span', { class: 'hud-know-segs', 'aria-hidden': 'true' });
  const knowNext = el('span', { class: 'hud-know-next' });
  const knowFull = el('span', { class: 'hud-know-full' });
  const knowCaption = el('span', { class: 'hud-know-caption', 'aria-hidden': 'true' }, knowNext, knowFull);
  knowTab.append(
    el('span', { class: 'hud-know-frame' },
      currencyIcon('Knowledge', { size: 'sm' }),
      knowValue,
      el('span', { class: 'hud-know-gauge' }, segments, knowCaption)),
    el('span', { class: 'hud-plus', 'aria-hidden': 'true' }),
  );
  knowTab.addEventListener('click', () => game.openKnowledge());


  // ONE gauge. Never "+6/h base −4/h upkeep = +2/h" — that
  // breakdown is the reliquary's job, on tap, where the player asked for it.
  const manaGauge = el('button', {
    class: 'hud-slot hud-mana', type: 'button', 'aria-label': 'Mana', 'data-coach': 'mana',
  });
  const manaFill = el('span', { class: 'hud-mana-fill' });
  const manaValue = el('b', {}, '');
  // The slot IS the gauge: the fill runs under the orb and the pool. While
  // the pool is filling, the pool and the next unit's countdown take turns
  // in the same place (see `cycle` below). The button is the whole slot.
  const manaBar = el('span', { class: 'hud-mana-bar' }, manaFill);
  const manaNext = el('span', { class: 'hud-mana-next', 'aria-hidden': 'true' });
  const manaReadout = el('span', { class: 'hud-mana-readout' }, manaValue, manaNext);
  manaGauge.append(manaBar, currencyIcon('Mana', { size: 'sm' }), manaReadout);
  manaGauge.addEventListener('click', () => game.openMana());

  // The Settings knob hangs from the plank's right end (M1). It is a drawer
  // opened twice a month, so it is not on the nav bar; it is chrome, so it
  // hangs from the chrome rather than floating over the map on its own.
  const knob = el('button', {
    class: 'hud-knob', type: 'button', 'aria-label': 'Settings',
  }, iconEl('settings', { size: 'md' }));
  knob.addEventListener('click', () => {
    game.setOverlay(game.openOverlay === 'settings' ? null : 'settings');
  });

  // THE FRIENDS KNOB (Docs/features/15-social.md §2.1) hangs beside it on a
  // rope of its own, and wears the red orb while someone asks to be friends.
  const friendsKnob = el('button', {
    class: 'hud-knob is-friends', type: 'button', 'aria-label': 'Friends', 'data-coach': 'friends',
  }, iconEl('friends', { size: 'md' }));
  friendsKnob.addEventListener('click', () => {
    if (game.openOverlay === 'friends') game.dismiss();
    else game.friends.open();
  });

  // The coins anchored left; the rope, Mana and Gems anchored right.
  plank.append(coins, el('span', { class: 'hud-divider' }), el('div', { class: 'hud-right' }, manaGauge, gems), knob, friendsKnob, knowTab);
  root.replaceChildren(plank, el('div', { class: 'hud-under' }, plaque));

  // Coin elements are rebuilt only when the VISIBLE SET changes; their values
  // are mutated in place. That keeps the shake animation and the counter
  // node stable across the per-second tick.
  const values = new Map<CurrencyId, HTMLElement>();
  let shown: string = '';

  const buildCoins = (list: CurrencyId[]) => {
    values.clear();
    coins.replaceChildren(...list.map((c) => {
      const value = el('b', {}, '0');
      values.set(c, value);
      // The icon's size is the slot's (hud.css), in reference pixels.
      //
      // Tapping any coin opens the purse — the only place the game explains
      // that berries, meat and fish all count as Food.
      const coin = el('button', {
        class: 'hud-slot hud-coin', type: 'button', 'data-currency': c, 'aria-label': c,
      }, currencyIcon(c, { size: 'sm' }), value);
      coin.addEventListener('click', () => game.setOverlay('purse'));
      return coin;
    }));
  };

  gems.append(
    currencyIcon('Gems', { size: 'sm' }),
    el('b', {}, '0'),
    el('span', { class: 'hud-plus', 'aria-hidden': 'true' }),
  );
  const gemValue = gems.querySelector('b')!;
  // The Gems plaque IS the store's door: its `+` was a no-op for the whole
  // life of the prototype (14-monetization.md §1.1). Coins still open the purse.
  gems.addEventListener('click', () => game.setOverlay('store'));

  const plaqueIcon = el('span', { class: 'hud-plaque-icon' });
  const plaqueValue = el('b', {}, '');
  plaque.append(plaqueIcon, plaqueValue);
  plaque.addEventListener('click', () => game.focusTownhall());

  // A denied purchase shakes the currency, not the button: the money is what
  // is missing, and it is where the player's eye already is.
  game.onShake((currencies) => {
    for (const c of currencies) {
      const node = values.get(c)?.closest('.hud-coin') ?? (c === 'Gems' ? gems : null);
      if (!node) continue;
      node.classList.remove('is-shaking');
      void (node as HTMLElement).offsetWidth; // restart the animation
      node.classList.add('is-shaking');
    }
  });

  // THE MANA READOUT TAKES TURNS. The pool shows; after POOL_MS without a
  // change it fades to the next unit's countdown for NEXT_MS, then back, and
  // round again. Any change to the pool snaps straight back to the pool.
  // Wall-clock time is fine here: this is presentation, not the sim.
  const POOL_MS = 3000;
  const NEXT_MS = 3000;
  let lastMana = Number.NaN;
  let lastManaChange = performance.now();
  let filling = false;
  const snapToPool = () => {
    manaReadout.classList.add('is-snap');
    manaReadout.classList.remove('is-next');
    void manaReadout.offsetWidth; // commit the jump before fades come back
    manaReadout.classList.remove('is-snap');
  };
  // The Knowledge caption takes turns the same way, between the next point
  // and the whole bar, on its own clock.
  let knowTurning = false;
  const cycle = () => {
    const t = (performance.now() - lastManaChange) % (POOL_MS + NEXT_MS);
    manaReadout.classList.toggle('is-next', filling && t >= POOL_MS);
    knowCaption.classList.toggle('is-full-turn',
      knowTurning && performance.now() % (POOL_MS + NEXT_MS) >= POOL_MS);
  };

  /** The plaque's icon is rebuilt only when what it shows changes. */
  let plaqueKind: string | null = null;
  const refresh = () => {
    const list = game.visibleCurrencies();
    const key = list.join(',');
    if (key !== shown) {
      shown = key;
      buildCoins(list);
    }
    // Rolled up past ten thousand, so a balance never outgrows its slot. The
    // purse (one tap away, on any coin) is where the exact figure lives.
    // Less whatever a reward in flight has not landed yet (hudHold.ts).
    const landed = (c: CurrencyId) => Math.max(0, game.walletValue(c) - heldOf(c));
    for (const [c, node] of values) setText(node, formatCount(landed(c)));
    setText(gemValue, formatCount(landed('Gems')));

    const slot = game.hudSlot();
    // Population is drawn on the world now, over the Townhall, so the plaque
    // only appears when it has something ELSE to say.
    plaque.hidden = slot.kind === 'population';
    if (!plaque.hidden) {
      // md, not sm: the status icons carry more internal detail than a coin
      // and turn to mush at 16px — the contact sheet made that obvious.
      if (plaqueKind !== slot.kind) {
        plaqueKind = slot.kind;
        plaqueIcon.replaceChildren(iconEl(SLOT_ICON[slot.kind]));
      }
      // Workers is a plain count — the villagers free to assign; the rest
      // read as a share of their ceiling.
      setText(plaqueValue, slot.kind === 'workers' ? formatCount(slot.value) : `${formatCount(slot.value)}/${formatCount(slot.max)}`);
      setAttr(plaque, 'aria-label', slot.kind === 'workers'
        ? `${SLOT_LABEL[slot.kind]} ${slot.value}`
        : `${SLOT_LABEL[slot.kind]} ${slot.value} of ${slot.max}`);
      plaque.disabled = true; // both remaining kinds are read-outs
    }

    // Mana is ALWAYS on the plank. It used to appear only once the player had
    // met magic, which was right when it only paid for relics; it now pays
    // for every tap, so hiding it would hide the reason a tap refused.
    const info = game.manaInfo();
    const m = { ...info, value: Math.max(0, info.value - heldOf('Mana')) };
    // The POOL, not "pool/cap". The gauge already draws the ratio as a fill
    // and turns its rim gold when it is spilling, so "/100" was the same fact
    // twice. The full reading stays in the aria-label and in the
    // Reliquary, which is what this gauge opens.
    if (m.value !== lastMana) {
      lastMana = m.value;
      lastManaChange = performance.now();
      // A pool that moved shows the pool AT ONCE — the tap that just spent
      // it must read immediately, not after a fade.
      snapToPool();
    }
    setText(manaValue, formatCount(m.value));
    setText(manaNext, m.nextIn ?? '');
    filling = m.nextIn !== null;
    setStyle(manaFill, 'width', `${m.cap === 0 ? 0 : Math.min(100, (m.value / m.cap) * 100)}%`);
    // Full and OVERCHARGED are different states: full means the next hour is
    // spilling, overcharged means an ad bought a pool the ceiling cannot hold.
    manaBar.classList.toggle('is-full', m.value >= m.cap && !m.over);
    manaBar.classList.toggle('is-over', m.over);
    setAttr(manaGauge, 'aria-label', m.over
      ? `Mana ${m.value}, overcharged past a ceiling of ${m.cap}`
      : `Mana ${m.value} of ${m.cap}, gaining ${m.net} an hour`);
    knob.classList.toggle('is-active', game.openOverlay === 'settings');
    // Absent until its door opens, like the Knowledge tab.
    friendsKnob.hidden = !game.doorOpen('friends');
    friendsKnob.classList.toggle('is-active', game.openOverlay === 'friends' || game.openOverlay === 'friendProfile'
      || game.openOverlay === 'crestEditor' || game.openOverlay === 'friendSearch');
    setCta(friendsKnob, friendsKnob.hidden ? 0 : game.friends.badge());

    const k = game.knowledgeInfo();
    const held = Math.max(0, k.value - heldOf('Knowledge'));
    setText(knowValue, formatCount(held));
    if (segments.childElementCount !== k.cap) {
      segments.replaceChildren(...Array.from({ length: k.cap }, () => el('i', {})));
    }
    // Each cell is a phial (hud.css): full for a point held, rising for the
    // one dripping in now, its level a straight line, empty past it.
    [...segments.children].forEach((seg, i) => {
      const fill = i < held ? 1 : i === held && !k.full ? k.nextFraction : 0;
      seg.classList.toggle('is-lit', i < held);
      setStyle(seg as HTMLElement, '--fill', fill.toFixed(3));
    });
    knowTab.classList.toggle('is-full', held >= k.cap);
    // A readout with nothing to read yet is absent: the bar comes with the
    // books (Docs/features/22-progression.md §3).
    knowTab.hidden = !game.doorOpen('knowledge');
    knowTab.classList.toggle('is-kept', game.keepsKnowledgeTab());
    setText(knowNext, k.full ? 'Full' : (k.nextIn ?? ''));
    setText(knowFull, k.fullIn ?? '');
    knowTurning = !k.full && k.fullIn !== null && k.nextIn !== null;
    if (!knowTurning) knowCaption.classList.remove('is-full-turn');
    setAttr(knowTab, 'aria-label', k.full
      ? `Knowledge ${held}, the bar is full`
      : `Knowledge ${held} of ${k.cap}, ${k.nextIn ?? ''}, ${k.fullIn ?? ''}`);
  };
  game.onChange(refresh);
  onHoldChange(refresh);
  refresh();
  window.setInterval(cycle, 200);
}
