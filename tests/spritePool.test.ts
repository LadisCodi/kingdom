// The <img> pool: a decoded image belongs to the element, so the element is
// what survives a rebuild (render/spritePool.ts). Node-only, on the stub DOM.
import { beforeAll, describe, expect, it } from 'vitest';
import { pooledCount, releaseSprites, spriteImgAt } from '../src/render/spritePool';
import { installStubDocument, stubNode, type StubNode } from './domStub';

const URL_A = '/assets/a.png';
const URL_B = '/assets/b.png';

beforeAll(installStubDocument);

describe('the sprite pool', () => {
  it('hands the same node back after a release, wearing the new class', () => {
    const root = stubNode('div');
    const first = spriteImgAt(URL_A, 'one') as unknown as StubNode;
    root.append(first);
    expect(first.src).toBe(URL_A);
    expect(first.className).toBe('one');
    expect(first.getAttribute('data-sprite')).toBe(URL_A);

    releaseSprites(root as unknown as ParentNode);
    expect(pooledCount(URL_A)).toBe(1);
    const second = spriteImgAt(URL_A, 'two') as unknown as StubNode;
    expect(second).toBe(first); // no re-decode: it is the same element
    expect(second.className).toBe('two');
    expect(pooledCount(URL_A)).toBe(0);
  });

  it('gives two live uses of one URL two nodes', () => {
    const a = spriteImgAt(URL_B);
    const b = spriteImgAt(URL_B);
    expect(a).not.toBe(b);
  });

  it('release ignores <img>s that are not the pool\'s, and never pools a node twice', () => {
    const root = stubNode('div');
    const foreign = stubNode('img');
    foreign.src = '/elsewhere.png';
    const ours = spriteImgAt('/assets/c.png') as unknown as StubNode;
    root.append(foreign, ours);
    releaseSprites(root as unknown as ParentNode);
    releaseSprites(root as unknown as ParentNode);
    expect(pooledCount('/elsewhere.png')).toBe(0);
    expect(pooledCount('/assets/c.png')).toBe(1);
  });
});
