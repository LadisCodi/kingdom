# Kingdom — Web Prototype

A cozy square-grid city-builder / idle game: reveal the fog with Silver, build
districts, grow and staff a population, harvest resources that accrue in real
time (including while away), and shape the land with magic.

Web reimplementation of the Unity prototype, built from the spec in [`Docs/`](Docs/).
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

The game is served at `https://<user>.github.io/Kingdom/` — share that URL
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
- **Trees yield 1 Wood** so the Tap spell has valid targets (the Unity data
  left `BaseYield` empty, making Tap unreachable).
- **Single tick driver** (the Unity build double-ticked its timer).
- Save format adds `kingdom.features` (feature destruction is now reachable and
  must persist) and folds Gems into the same file (`player.currencies`).
- Placeholder art: flat-color tiles + emoji glyphs; state-driven rendering so
  real pixel art can slot in without logic changes.

Everything else follows the docs as-built, including tap-per-unit vault
collection and FarmLands' uncapped wallet-direct income.
