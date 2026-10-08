// A planted feature draws its growth stages in turn (Docs/features/27-plantables.md §2).

import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pickGrowthStage } from '../src/render/growth';

const onDisk = (key: string): boolean => existsSync(`src/render/assets/${key}.png`);

describe('growth stages', () => {
  it('walks a forest through its three drawings, one third of the wait each', () => {
    expect(pickGrowthStage('forest', 0, onDisk)).toBe('forest_growing1');
    expect(pickGrowthStage('forest', 0.34, onDisk)).toBe('forest_growing2');
    expect(pickGrowthStage('forest', 0.67, onDisk)).toBe('forest_growing3');
    expect(pickGrowthStage('forest', 1, onDisk)).toBe('forest_growing3');
  });

  it('has none for a feature with no growth drawings', () => {
    expect(pickGrowthStage('mountain', 0.5, onDisk)).toBeNull();
  });
});
