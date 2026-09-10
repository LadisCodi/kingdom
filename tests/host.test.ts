// legacy(): the per-tick rebuild must not be VISIBLE — scroll position kept
// by name and written only when it moved, the slide-in on the first build
// only, sprites handed back to the pool before the render that wants them.
import { beforeAll, describe, expect, it } from 'vitest';
import { legacy } from '../src/ui/kit/host';
import { pooledCount, spriteImgAt } from '../src/render/spritePool';
import { installStubDocument, stubNode, type StubNode } from './domStub';

beforeAll(installStubDocument);

const scroller = (name: string, cls = ''): StubNode => {
  const n = stubNode('div');
  n.className = cls;
  n.setAttribute('data-keep-scroll', name);
  return n;
};

describe('legacy() across rebuilds', () => {
  it('restores scroll by name, not by order, and only writes what moved', () => {
    let withExtra = false;
    const render = () => {
      const root = stubNode('div');
      // A section that appears on the second build, ABOVE the long scroller:
      // matched by order, the long scroller would inherit the newcomer's 0.
      if (withExtra) root.append(scroller('extra'));
      root.append(scroller('long'));
      return root as unknown as HTMLElement;
    };
    const screen = legacy(render);
    screen.refresh();
    const long = (screen.root as unknown as StubNode).querySelector('[data-keep-scroll="long"]')!;
    long.scrollTop = 420;
    long.scrollWrites = 0;

    withExtra = true;
    screen.refresh();
    const after = (screen.root as unknown as StubNode).querySelector('[data-keep-scroll="long"]')!;
    expect(after.scrollTop).toBe(420);
    expect(after.scrollWrites).toBe(1); // the restore itself
    const extra = (screen.root as unknown as StubNode).querySelector('[data-keep-scroll="extra"]')!;
    expect(extra.scrollWrites).toBe(0); // nothing was kept for it

    // A rebuilt scroller is a NEW node at 0, so the restore is one write per
    // rebuild, never more — and a scroller sitting at the top costs none.
    screen.refresh();
    const third = (screen.root as unknown as StubNode).querySelector('[data-keep-scroll="long"]')!;
    expect(third.scrollTop).toBe(420);
    expect(third.scrollWrites).toBe(1);
    expect((screen.root as unknown as StubNode).querySelector('[data-keep-scroll="extra"]')!.scrollWrites).toBe(0);
  });

  it('marks the sheet fresh on the first build only', () => {
    const render = () => {
      const root = stubNode('div');
      const sheet = stubNode('div');
      sheet.className = 'k-sheet';
      root.append(sheet);
      return root as unknown as HTMLElement;
    };
    const screen = legacy(render);
    screen.refresh();
    const first = (screen.root as unknown as StubNode).querySelector('.k-sheet')!;
    expect(first.hasAttribute('data-fresh')).toBe(true);
    screen.refresh();
    const second = (screen.root as unknown as StubNode).querySelector('.k-sheet')!;
    expect(second).not.toBe(first);
    expect(second.hasAttribute('data-fresh')).toBe(false);
  });

  it('hands sprites back before the render that asks for them again', () => {
    const url = '/assets/host.png';
    let taken: StubNode[] = [];
    const render = () => {
      const root = stubNode('div');
      const img = spriteImgAt(url, 'art') as unknown as StubNode;
      taken.push(img);
      root.append(img);
      return root as unknown as HTMLElement;
    };
    const screen = legacy(render);
    screen.refresh();
    screen.refresh();
    screen.refresh();
    expect(taken[1]).toBe(taken[0]); // the same node, three builds running
    expect(taken[2]).toBe(taken[0]);
    expect(pooledCount(url)).toBe(0); // it is in the tree, not idle
    taken = [];
  });

  it('skips the rebuild while the signature holds', () => {
    let sig = 'a';
    let builds = 0;
    const screen = legacy(() => { builds += 1; return stubNode('div') as unknown as HTMLElement; },
      undefined, () => sig);
    screen.refresh();
    screen.refresh();
    expect(builds).toBe(1);
    sig = 'b';
    screen.refresh();
    expect(builds).toBe(2);
  });
});
