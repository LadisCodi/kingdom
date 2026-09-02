# Kingdom — Web Prototype

A cozy square-grid city-builder / idle game: reveal the fog with Gold, tap
resource cells to harvest them (they exhaust and recover), build districts
whose workers walk out to harvest for you, and grow a population that pays
taxes. Progress continues while away (simulated, capped at 8h).

Web reimplementation of the Unity prototype, built from the spec in [`Docs/`](Docs/),
with the harvest-loop rework described in
[`Docs/features/harvest-loop.md`](Docs/features/harvest-loop.md).
Vite + TypeScript, Canvas 2D, no framework. The simulation core (`src/sim/`) is
pure TS — no DOM, no clock, injectable randomness — so it can later run
server-side (e.g. to validate player-to-player trades).

## Play locally

```bash
npm install
npm run dev        # → http://localhost:5173
npm test           # sim unit tests + headless end-to-end smoke
```

Without Supabase configured the game runs in **local-save-only** mode
(localStorage). Append `?dev` to the URL for the dev bar (time-warp to demo
offline progress, save reset).

## Cloud saves (Supabase, optional)

1. Create a free project at [supabase.com](https://supabase.com).
2. Paste `supabase/schema.sql` into the SQL editor and run it.
3. Enable **Anonymous sign-ins**: Authentication → Sign In / Up → Anonymous.
4. Copy `.env.example` to `.env.local` and fill in the project URL + anon key
   (Settings → API).
5. `npm run dev` — the header shows “☁️ cloud save”.

Each browser gets an anonymous account; the save follows it across visits.
Clearing browser storage orphans the anonymous save (prototype limitation).
The anon key is public by design — row-level security is the boundary.

## Deploy (GitHub Pages)

Pushing to `main` runs `.github/workflows/deploy.yml`: test → build → deploy.
One-time setup:

1. Repo **Settings → Pages** → Source: **GitHub Actions**.
2. (Optional, for cloud saves) **Settings → Secrets and variables → Actions →
   Variables**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

The game is served at `https://ladiscodi.github.io/kingdom/` — share that URL
with playtesters. If the repo is renamed, update `base` in `vite.config.ts`.

## Where things live

| Path | What |
|---|---|
| `Docs/` | `00`–`11`: the Unity as-built spec the port was built from. `Docs/features/`: the web build's own design docs — the live source of truth |
| `balance/` | Editable balance workbook (`balance.xlsx`) — tweak, then `npm run balance` |
| `src/sim/` | Pure simulation core (state, economy, queue, fog, research, army, save format) |
| `src/sim/data/` | Definitions + generated `balance.json` + the region map |
| `src/render/` | Canvas renderer, camera, input, tap-handler chain |
| `src/ui/` | HTML/CSS screens (header, build menu, district card, research, army) |
| `src/persist/` | localStorage + Supabase save orchestration |
| `tests/` | Formula tests pinned to the docs' worked examples + headless e2e smoke |

## Deliberate deviations from the Unity build

- **Square grid** (was hex). Three metrics coexist by design: fog, placement and
  BFS distance use **4-way von Neumann** adjacency (`src/sim/grid.ts:9-11`),
  building areas of influence use **Chebyshev**, and worker travel uses
  **Euclidean**. Balance data unchanged.
- **The harvest loop** (see the feature doc): the generator/vault economy is
  replaced by tappable resource cells with exhaustion/recovery, workers as
  moving units, and radius-by-level areas
  of influence. Lumber is renamed Sawmill. Spells (and Mana) are removed for
  now, pending a future rework.
- **The Gold economy**: Silver and Gold are merged into one money (Gold). The
  idle backbone is **housing taxes** — every housed villager pays passively, and
  a lived-in house is itself a tappable gold cell. The **Market** is an optional
  building for selling surplus: an **instant bulk sale**, not a drip
  (`src/sim/market.ts:26-43`). The Townhall trains villagers over time
  (tap-boostable), replacing the instant population purchase. See
  [`Docs/features/economy-taxes-and-market.md`](Docs/features/economy-taxes-and-market.md).
- **Four city coins, not six.** Berry bushes, game and shoals all pay **Food**
  (1, 3 and 2 a tap) and an iron vein is a rich **Stone** node (3 a tap), so
  Berries, Meat, Fish and Iron are cells rather than currencies. The wallet is
  Gold · Food · Wood · Stone, plus Mana (the capped tap budget), Knowledge
  (kingdom-scoped, won from dungeons, spent only on relic and hero levels) and
  Gems. The technology tree is priced in Gold from the city purse. See
  [`Docs/features/currency-simplification.md`](Docs/features/currency-simplification.md).
- **Single tick driver** (the Unity build double-ticked its timer).
- Save format v2; incompatible older saves start a fresh game.
- Placeholder art: flat-color tiles + emoji glyphs; state-driven rendering so
  real pixel art can slot in without logic changes.

Costs, times, count caps, fog, population, the build queue and the army follow
the docs as-built.
