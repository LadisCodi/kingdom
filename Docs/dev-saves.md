# A progressed save, for looking at screens the opening never shows

> **Scope.** How to put the game into a late state on purpose, and the one
> thing about doing it that is not obvious.
>
> **Status: a recipe, not a tool.** It needs `tsx`, which is not a dependency
> — `npx tsx` fetches it for the one run.

Several screens cannot be judged from a new save. The research page is the
clearest case: on a fresh game *locked*, *in progress* and *done* — the
three states its whole design turns on
([`features/07-research.md`](features/07-research.md) §5.2) — never appear
together until a real player is hours in.

## Make one

Write a script that builds the state through the sim's own entry points and
serialises it with the real `serialize()`. Not JSON shaped like a save: **a
save the game would have written**, so `deserialize` cannot reject it and the
version is whatever `SAVE_VERSION` is today.

```ts
import { newGame } from './src/sim/newGame';
import { buildMapData, cellsWithinRadius, cellExists } from './src/sim/grid';
import { serialize } from './src/sim/save';
import { coordKey } from './src/sim/state';

const now = Date.now();
const map = buildMapData();
const state = newGame(map, now);

// Fog: the research bands are gated on revealed cells, and the last one
// (Warfare IV, Magic IV) asks for 220 — see `eras` in tech-tree.json.
for (let r = 1; r <= 14; r++) {
  for (const cell of cellsWithinRadius(map, { x: 0, y: 0 }, r)) {
    if (!cellExists(map, cell)) continue;
    state.fog.revealed[coordKey(cell)] = true;
    state.fog.discovered[coordKey(cell)] = true;
  }
}

state.research.completed = [/* TechIds */];
state.research.poured = { ButcheryII: 2 }; // Knowledge poured into one not yet done
state.tutorial.veteran = true;              // every door and book open, no First Morning
state.city.wallet.Gold = 4_200;
state.kingdom.wallet.Knowledge = 40;

writeFileSync('save.json', JSON.stringify(serialize(state, now)));
```

Run it from the repo root, where the imports resolve:

```sh
npx tsx ./_mkSave.ts save.json
```

## Load it — and the part that is not obvious

**The running game saves over localStorage when the page unloads**
(`main.ts`'s `pagehide` handler). So writing the key from the console of a tab
that has the game open and then reloading loses the save: the old state is
written on the way out, after the injection.

Load it from a page on the same origin that **does not boot the game**. Drop a
file at the repo root — Vite serves it — and visit that first:

```html
<!-- _load.html -->
<script type="module">
  const r = await fetch('/_devsave.json');
  localStorage.setItem('kingdom.save', await r.text());
  document.body.textContent = 'stored — now open /';
</script>
```

Then open `/`. A save with no payer profile asks who you are playing as before
the map, which is itself a screen worth seeing.

Delete `_load.html`, `_devsave.json` and the script afterwards; none of them
belong in a commit.
