// Every bust's placement in the round frame (src/ui/bustFraming.json) names
// a file that exists, and stays inside the range it was set in.
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import BUST_FRAMING from '../src/ui/bustFraming.json';

describe('bust framing', () => {
  for (const [key, f] of Object.entries(BUST_FRAMING)) {
    it(`${key} is a real bust, framed within bounds`, () => {
      expect(existsSync(`src/render/assets/${key}.png`)).toBe(true);
      expect(Math.abs(f.dx)).toBeLessThanOrEqual(128);
      expect(Math.abs(f.dy)).toBeLessThanOrEqual(128);
      expect(f.scale).toBeGreaterThanOrEqual(0.7);
      expect(f.scale).toBeLessThanOrEqual(1.4);
    });
  }
});
