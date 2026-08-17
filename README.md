# Kingdom — Web Prototype

A cozy square-grid city-builder / idle game: reveal the fog with Silver, tap
resource cells to harvest them (they exhaust and recover), build districts
whose workers walk out to harvest for you, grow a population, and shape the
land with magic. Progress continues while away (simulated, capped at 8h).

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
| `Docs/` | The complete game spec the port was built from |
| `src/sim/` | Pure simulation core (state, economy, queue, fog, spells, army, save format) |
| `src/sim/data/` | All balancing data transcribed from the docs + the region map |
| `src/render/` | Canvas renderer, camera, input, tap-handler chain |
| `src/ui/` | HTML/CSS screens (header, build menu, district card, spellbook, army) |
| `src/persist/` | localStorage + Supabase save orchestration |
| `tests/` | Formula tests pinned to the docs' worked examples + headless e2e smoke |

## Deliberate deviations from the Unity build

- **Square grid, 8-neighbor adjacency** (was hex / 6) — user decision; balance
  data unchanged, the fog seed reveals 8 neighbors instead of 6.
- **The harvest loop** (see the feature doc): the generator/vault economy is
  replaced by tappable resource cells with exhaustion/recovery, workers as
  moving units, a tap-boostable Townhall tax cycle, and radius-by-level areas
  of influence. Lumber is renamed Sawmill; Rain now doubles a rained cell's
  recovery speed; the Tap spell is dormant pending a spell rework.
- **Single tick driver** (the Unity build double-ticked its timer).
- Save format v2; incompatible older saves start a fresh game.
- Placeholder art: flat-color tiles + emoji glyphs; state-driven rendering so
  real pixel art can slot in without logic changes.

Costs, times, count caps, fog, population, the build queue and the army follow
the docs as-built.
