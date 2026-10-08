// A building's art on a card is the art the map draws for it
// (src/render/sprites.ts `buildingArtUrl`): a card that showed an icon for
// a crop plot planted as a wheat field read as a different thing.
import { describe, expect, it, vi } from 'vitest';

// The sprite module preloads every picture as it is imported; under node
// there is no Image, so a bare one stands in.
vi.hoisted(() => {
  (globalThis as { Image?: unknown }).Image ??= class {
    onload: (() => void) | null = null; onerror: (() => void) | null = null; src = ''; decoding = '';
    decode(): Promise<void> { return Promise.resolve(); }
  };
});
import { DISTRICTS, FEATURES } from '../src/sim/data/definitions';
import { buildingArtUrl, spriteUrl } from '../src/render/sprites';
import type { DistrictId } from '../src/sim/state';

describe('the art a building shows on its card', () => {
  it('is art for every building the menu offers, never the icon standing in', () => {
    const missing = (Object.keys(DISTRICTS) as DistrictId[])
      .filter((id) => DISTRICTS[id].buildable)
      .filter((id) => {
        const def = DISTRICTS[id];
        return buildingArtUrl(def.sprite, 1, def.plants === null ? null : FEATURES[def.plants].sprite) === null;
      });
    expect(missing).toEqual([]);
  });

  it('is the planted feature for a plantable — the field the map draws', () => {
    const plots = DISTRICTS.FarmLands;
    expect(plots.plants).toBe('Crops');
    expect(spriteUrl(FEATURES.Crops.sprite)).not.toBeNull();
    expect(buildingArtUrl(plots.sprite, 1, FEATURES.Crops.sprite)).toBe(spriteUrl(FEATURES.Crops.sprite));
  });

  it('walks down to the highest tier at or below the level, as the map does', () => {
    expect(spriteUrl('housing_l4')).not.toBeNull();
    expect(buildingArtUrl('housing', 5)).toBe(spriteUrl('housing_l4'));
    expect(buildingArtUrl('housing', 1)).toBe(spriteUrl('housing_l1'));
  });
});
