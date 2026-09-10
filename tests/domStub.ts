// A DOM small enough to read in one sitting, for the node-only tests of the
// screen host and the sprite pool. It answers exactly what those two ask —
// create, attributes, children, the four selectors they use, and a scroll
// position with a write counter — and nothing else. A real DOM in the test
// runner would hide the one thing these tests are about: how many writes
// the host makes, and to which node.
export interface StubNode {
  tag: string;
  className: string;
  src: string;
  alt: string;
  attrs: Map<string, string>;
  children: StubNode[];
  parent: StubNode | null;
  scrollTop: number;
  scrollLeft: number;
  /** Assignments to scrollTop/scrollLeft, the thing the host must ration. */
  scrollWrites: number;
  setAttribute(k: string, v: string): void;
  getAttribute(k: string): string | null;
  hasAttribute(k: string): boolean;
  removeAttribute(k: string): void;
  addEventListener(): void;
  append(...n: StubNode[]): void;
  replaceChildren(...n: StubNode[]): void;
  querySelectorAll(sel: string): StubNode[];
  querySelector(sel: string): StubNode | null;
}

/** `[attr]`, `[attr="v"]`, `.class`, `tag[attr]` — the selectors the host uses. */
const matches = (n: StubNode, sel: string): boolean => {
  const m = /^([a-z]*)(?:\.([\w-]+))?(?:\[([\w-]+)(?:="([^"]*)")?\])?$/.exec(sel);
  if (!m) throw new Error(`stub DOM cannot match ${sel}`);
  const [, tag, cls, attr, value] = m;
  if (tag && n.tag !== tag) return false;
  if (cls && !n.className.split(' ').includes(cls)) return false;
  if (attr && !n.attrs.has(attr)) return false;
  if (value !== undefined && n.attrs.get(attr) !== value) return false;
  return true;
};

const descendants = (n: StubNode): StubNode[] =>
  n.children.flatMap((c) => [c, ...descendants(c)]);

export function stubNode(tag: string): StubNode {
  let top = 0;
  let left = 0;
  const node: StubNode = {
    tag,
    className: '',
    src: '',
    alt: '',
    attrs: new Map(),
    children: [],
    parent: null,
    scrollWrites: 0,
    get scrollTop() { return top; },
    set scrollTop(v: number) { top = v; node.scrollWrites += 1; },
    get scrollLeft() { return left; },
    set scrollLeft(v: number) { left = v; node.scrollWrites += 1; },
    setAttribute: (k, v) => { node.attrs.set(k, v); },
    getAttribute: (k) => node.attrs.get(k) ?? null,
    hasAttribute: (k) => node.attrs.has(k),
    removeAttribute: (k) => { node.attrs.delete(k); },
    addEventListener: () => {},
    append: (...ns) => {
      for (const c of ns) {
        // Moving a node, as the real DOM does: one parent at a time.
        if (c.parent) c.parent.children = c.parent.children.filter((x) => x !== c);
        c.parent = node;
        node.children.push(c);
      }
    },
    replaceChildren: (...ns) => {
      for (const c of node.children) c.parent = null;
      node.children = [];
      node.append(...ns);
    },
    querySelectorAll: (sel) => descendants(node).filter((c) => matches(c, sel)),
    querySelector: (sel) => descendants(node).find((c) => matches(c, sel)) ?? null,
  };
  return node;
}

/** Install `document.createElement` for the module under test. */
export function installStubDocument(): void {
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tag: string) => stubNode(tag),
  };
}
