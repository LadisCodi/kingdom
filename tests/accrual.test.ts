import { describe, expect, it } from 'vitest';
import { accrueGenerator, generationPerMinute, makeGenerator } from '../src/sim/economy';
import type { Generator, Wallet } from '../src/sim/state';

const NOW = Date.parse('2026-08-17T12:00:00Z');
const rngZero = () => 0; // makeGenerator stagger = 0

const gen = (ratePerMin: number, vaultCapacity: number, lastProduction = NOW): Generator => {
  const g = makeGenerator('g_Test', 'Food', vaultCapacity, lastProduction, rngZero);
  g.modifiers.push({ category: 'Building', source: 't', kind: 'Flat', value: ratePerMin });
  return g;
};

describe('rate formula', () => {
  it('flat × (1 + pct), flat clamped at 0', () => {
    const g = gen(5, 0);
    g.modifiers.push({ category: 'Spell', source: 's', kind: 'Percentage', value: 4 });
    expect(generationPerMinute(g)).toBe(25); // Rain ×5
    g.modifiers[0].value = -3;
    expect(generationPerMinute(g)).toBe(0);
  });
});

describe('accrual algorithm branches (Docs/03)', () => {
  it('rate 0 → timestamp reset, no backlog', () => {
    const g = gen(0, 0, NOW - 600_000);
    const wallet: Wallet = {};
    accrueGenerator(g, wallet, NOW);
    expect(g.lastProduction).toBe(NOW);
    expect(wallet.Food ?? 0).toBe(0);
  });
  it('full vault → overflow LOST, timestamp reset', () => {
    const g = gen(5, 50, NOW - 600_000);
    g.vaultStored = 50;
    accrueGenerator(g, {}, NOW);
    expect(g.lastProduction).toBe(NOW);
    expect(g.vaultStored).toBe(50);
  });
  it('whole units only; sub-unit remainder kept (timestamp untouched)', () => {
    const g = gen(5, 0, NOW - 6_000); // 0.5 units in 6s at 5/min
    const wallet: Wallet = {};
    accrueGenerator(g, wallet, NOW);
    expect(wallet.Food ?? 0).toBe(0);
    expect(g.lastProduction).toBe(NOW - 6_000);
  });
  it('timestamp advances only by the time paid out', () => {
    const g = gen(5, 0, NOW - 30_000); // 2.5 units in 30s
    const wallet: Wallet = {};
    accrueGenerator(g, wallet, NOW);
    expect(wallet.Food).toBe(2);
    expect(g.lastProduction).toBe(NOW - 30_000 + (2 / 5) * 60_000); // +24s
  });
  it('offline lump-sum clamps at vault capacity', () => {
    const g = gen(5, 50, NOW - 3_600_000); // 300 units in an hour
    accrueGenerator(g, {}, NOW);
    expect(g.vaultStored).toBe(50);
  });
  it('wallet-direct (FarmLands) accrues without cap offline', () => {
    const g = gen(3, 0, NOW - 3_600_000); // 180 units in an hour
    const wallet: Wallet = {};
    accrueGenerator(g, wallet, NOW);
    expect(wallet.Food).toBe(180);
  });
  it('capped wallet (Mana) stops at the cap', () => {
    const g = makeGenerator('kingdom_Mana', 'Mana', 0, NOW - 3_600_000, rngZero);
    g.modifiers.push({ category: 'Building', source: 'k', kind: 'Flat', value: 5 });
    const wallet: Wallet = { Mana: 50 };
    accrueGenerator(g, wallet, NOW); // 300 possible, cap 100
    expect(wallet.Mana).toBe(100);
    const before = wallet.Mana;
    accrueGenerator(g, wallet, NOW + 60_000); // full → timestamp reset, nothing credited
    expect(wallet.Mana).toBe(before);
    expect(g.lastProduction).toBe(NOW + 60_000);
  });
});

describe('worked rates (Docs/03 examples)', () => {
  it('Farm with 3 workers + 2 FarmLands = 11 Food/min; TH pop 7 = 35 Silver/min', () => {
    // Base 5 (staffed) + 3 × min(2, 3−1) worked = 11.
    const farm = gen(5, 50);
    farm.modifiers.push({ category: 'Feature', source: 'f', kind: 'Flat', value: 3 * 2 });
    expect(generationPerMinute(farm)).toBe(11);
    // Townhall: 5 Silver/min × 7 population; 50-cap vault fills in ~86 s.
    const th = makeGenerator('th_Silver', 'Silver', 50, NOW, rngZero);
    th.modifiers.push({ category: 'Population', source: 't', kind: 'Flat', value: 5 * 7 });
    expect(generationPerMinute(th)).toBe(35);
    accrueGenerator(th, {}, NOW + 86_000);
    expect(th.vaultStored).toBe(50);
  });
});
