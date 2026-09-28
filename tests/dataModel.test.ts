import { describe, expect, it } from 'vitest';
import { DataModel } from '../src/editor/data/doc';

const fresh = () => new DataModel({ a: { x: 1, list: [1, 2, 3] }, m: { Wood: 5 } });

describe('data editor model', () => {
  it('diffs one leaf per edit and undoes it', () => {
    const m = fresh();
    m.set(['a', 'list', 1], 20);
    m.set(['m', 'Stone'], 3);
    expect(m.diff()).toEqual([
      { path: ['a', 'list', 1], before: 2, after: 20 },
      { path: ['m', 'Stone'], before: undefined, after: 3 },
    ]);
    m.undo();
    expect(m.get(['m', 'Stone'])).toBeUndefined();
    m.undo();
    expect(m.diff()).toEqual([]);
    m.redo();
    expect(m.get(['a', 'list', 1])).toBe(20);
  });

  it('groups a batch into one undo step, and ignores no-op writes', () => {
    const m = fresh();
    m.batch(() => { m.set(['a', 'x'], 2); m.set(['m', 'Wood'], 6); m.set(['m', 'Wood'], 6); });
    m.set(['a', 'x'], 2);
    m.undo();
    expect(m.diff()).toEqual([]);
    expect(m.canUndo()).toBe(false);
  });

  it('renames a key in place and treats a resized list as one change', () => {
    const m = fresh();
    m.renameKey(['m'], 'Wood', 'Stone');
    expect(Object.keys(m.get(['m']) as object)).toEqual(['Stone']);
    m.set(['a', 'list'], [1, 2]);
    expect(m.diffUnder(['a'])).toEqual([{ path: ['a', 'list'], before: [1, 2, 3], after: [1, 2] }]);
  });
});
