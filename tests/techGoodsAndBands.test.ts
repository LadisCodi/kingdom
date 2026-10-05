// A technology's goods, and the card pack a finished band pays
// (Docs/plans/tech-tree-rework.md §3.4–§3.5).
import { afterEach, describe, expect, it } from 'vitest';
import { ERA_REWARDS, TECHNOLOGIES, TECH_ORDER, type PackTier } from '../src/sim/data/definitions';
import { validateTechTree, type TechTreeDoc } from '../src/sim/data/techTreeRules';
import treeDoc from '../src/sim/data/tech-tree.json';
import {
  canResearchTech, canStartTech, claimBandReward, completeTech as researchComplete,
  isBandFinished, pourKnowledge, techGoodsCost,
} from '../src/sim/research';
import { researchTech } from '../src/sim/commands';
import { deserialize, serialize } from '../src/sim/save';
import { getGood } from '../src/sim/goods';
import type { GameState, TechId, TomeId } from '../src/sim/state';
import { completeTech, freshGame, fund, map, T0 } from './helpers';

const TOME: TomeId = 'Civics';
const ERA = 1;
const band = (): TechId[] => TECH_ORDER.filter((id) => TECHNOLOGIES[id].placed
  && TECHNOLOGIES[id].tome === TOME && TECHNOLOGIES[id].era === ERA);
/** The band's last card in reading order: everything it needs sits above it. */
const last = (): TechId => band().at(-1)!;

const restore: Array<() => void> = [];
afterEach(() => { while (restore.length > 0) restore.pop()!(); });

const withGoods = (id: TechId, goods: Record<string, number>): void => {
  const before = TECHNOLOGIES[id].goods;
  TECHNOLOGIES[id].goods = goods;
  restore.push(() => { TECHNOLOGIES[id].goods = before; });
};
const withReward = (tier: PackTier | null): void => {
  const before = ERA_REWARDS[TOME][ERA];
  ERA_REWARDS[TOME][ERA] = tier;
  restore.push(() => { ERA_REWARDS[TOME][ERA] = before; });
};

/** Every card of the band done but the last, which is ready to research. */
function oneCardShort(): GameState {
  const state = freshGame();
  state.tutorial.veteran = true;
  for (const id of band()) if (id !== last()) completeTech(state, id);
  fund(state, { Gold: 1e9, Knowledge: 1e6 });
  return state;
}

describe('goods on a technology', () => {
  it('asks for them with the Gold, refuses without them, and pays them', () => {
    const id = last();
    withGoods(id, { Planks: 2 });
    const state = oneCardShort();
    expect(techGoodsCost(id)).toEqual({ Planks: 2 });
    pourKnowledge(state, id);
    expect(canResearchTech(state, id)).toBe(false);
    expect(canStartTech(state, id)).toBe(false);
    expect(researchComplete(state, id)).toBe('NotEnoughGoods');
    expect(state.research.completed).not.toContain(id);
    state.city.goods.Planks = 3;
    expect(canResearchTech(state, id)).toBe(true);
    expect(researchComplete(state, id)).toBe('Researched');
    expect(getGood(state.city.goods, 'Planks')).toBe(1);
  });

  it('costs no goods when the card names none', () => {
    for (const id of TECH_ORDER) expect(TECHNOLOGIES[id].goods).toEqual({});
  });

  it('refuses a good that does not exist, or a count below one', () => {
    const doc = structuredClone(treeDoc) as unknown as TechTreeDoc;
    doc.technologies.Forestry.goods = { Marble: 1 };
    expect(validateTechTree(doc).errors.map((e) => e.message).join('\n')).toMatch(/Marble/);
    doc.technologies.Forestry.goods = { Planks: 0 };
    expect(validateTechTree(doc).errors.map((e) => e.message).join('\n')).toMatch(/whole number/);
  });
});

describe('the card pack a finished band pays', () => {
  it('pays once, the moment the last card of the band is researched', () => {
    withReward('Green');
    const state = oneCardShort();
    const packs = state.collection.packs.length;
    expect(isBandFinished(state, TOME, ERA)).toBe(false);
    expect(researchTech(state, map, (pourKnowledge(state, last()), last()), T0)).toBe('Researched');
    expect(isBandFinished(state, TOME, ERA)).toBe(true);
    expect(state.collection.packs.length).toBe(packs + 1);
    expect(state.collection.packs.at(-1)!.tier).toBe('Green');
    expect(state.research.rewarded).toEqual(['Civics:1']);
    // Asked again, the band has paid already.
    expect(claimBandReward(state, last())).toBeNull();
    expect(state.collection.packs.length).toBe(packs + 1);
  });

  it('pays nothing while a card of the band is left, and nothing for a band with no reward', () => {
    withReward('Green');
    const state = oneCardShort();
    const other = band().find((id) => id !== last())!;
    expect(claimBandReward(state, other)).toBeNull();
    expect(state.research.rewarded).toEqual([]);
    withReward(null);
    completeTech(state, last());
    expect(claimBandReward(state, last())).toBeNull();
  });

  it('remembers what it paid across a save', () => {
    withReward('Green');
    const state = oneCardShort();
    pourKnowledge(state, last());
    researchTech(state, map, last(), T0);
    const loaded = deserialize(serialize(state, T0), map, T0)!;
    expect(loaded.research.rewarded).toEqual(['Civics:1']);
    expect(claimBandReward(loaded, last())).toBeNull();
  });

  it('is validated: one entry per band, and only packs that exist', () => {
    const doc = structuredClone(treeDoc) as unknown as TechTreeDoc;
    expect(validateTechTree(doc).ok).toBe(true);
    doc.eraRewards = { ...doc.eraRewards, Civics: ['Green'] };
    expect(validateTechTree(doc).errors.map((e) => e.message).join('\n')).toMatch(/band rewards/);
    doc.eraRewards = { ...doc.eraRewards, Civics: ['Green', null, 'Diamond'] };
    expect(validateTechTree(doc).errors.map((e) => e.message).join('\n')).toMatch(/Diamond/);
  });
});
