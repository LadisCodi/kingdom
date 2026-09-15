# Plan — the eight-album collection

> **What this is.** The step-by-step order in which the three proposals land:
> [`../proposals/relic-effects.md`](../proposals/relic-effects.md) (what the
> relics do), [`../proposals/album-cycles.md`](../proposals/album-cycles.md)
> (eight albums, the rotation, the cycle) and
> [`../proposals/collection-packs.md`](../proposals/collection-packs.md) (the
> packs, the chests, the stars). It owns the **sequence**; the designs stay in
> `proposals/` until each step closes and moves them into `features/09`.
>
> **Status: steps 1, 2 and 3 done 2026-09-15.** Save version 48.
>
> **One decision gates a third of it** — **OQ-98**, whether the relic actives
> stay on the relics or become Magic-tome spells. Steps 1–5 are safe either
> way; step 6 is void if the tome wins.

## 0. How the steps are cut

- **Data first, logic second, UI third, test throughout.** Every step opens by
  moving `scripts/balance.mjs` and the workbook — the importer refuses unknown
  columns, so the schema is the first commit.
- **Every step ships on its own and leaves a playable game.** No step depends
  on the one after it.
- **Art never blocks a step.** `render/sprites.ts` picks up any PNG dropped in
  `src/render/assets/` by filename and falls back to a glyph until then, so §7
  runs alongside everything and lands one file at a time.
- **Each step names its save impact.** Additive changes bump `SAVE_VERSION`
  and nothing else; a migrator only where a step renames or reshapes.
- **Each step ends with the same three tests:** the rule, the one-call-equals-
  stepped replay of anything timed, and — where the step moves a faucet — a
  re-run of the pack simulation whose numbers the proposals quote.

### The order

| Step | Lands | Blocked by | Size |
|---|---|---|---|
| ~~**1**~~ | ~~The five passives take their final shape~~ **done** (OQ-97 closed) | — | **M** |
| ~~**2**~~ | ~~Eight relics exist, as passives~~ **done** | 1 | **M** |
| ~~**3**~~ | ~~The packs, the chests and the stars~~ **done** | — | **M** |
| **4** | Eight albums, and the pairing rotates | 2, 3 | **M** |
| **5** | The album cycle | 4 | **M** |
| **6** | Zones, cooldowns and the actives | **OQ-98**, 2 | **L** |
| **7** | The art | — (runs alongside) | **M** |

- **1 and 3 are independent** and can go in either order or at once.
- **1 grew from S to M** once the proposal was read against the build: four of
  the five relics change which number they move, not just its sign.
- **6 is the only large one** and the only one that can be cut whole.

## 1. The five passives take their final shape

Not just the two that die. Four of the five change stat, so doing the shape fix
now and the re-pointing later would migrate the same `Artifacts` rows twice and
re-balance them twice.

| Relic | Today | After |
|---|---|---|
| **Dowsing Rod** | `cellRecovery` ×0.85, **−0.05** | `recoverySpeed` ×1.20, +0.20 |
| **Verdant Seal** | `cellRespawn` ×0.85, **−0.05** | units per strike **+1** and stock **+1** a level |
| **Foreman's Sigil** | `workerYield` **+1 flat**, +0.5 | crew speed ×1.10, +0.10 — swing **and** walk |
| **Gilded Ledger** | `taxRate` ×1.10, +0.10, global | tax **at a house** ×1.05, +0.05 |
| **Wanderer's Compass** | `stardustYield` ×1.25, +0.25 | ×1.05, +0.05 |

- **Data** — five rows on `Artifacts`, and a `stat` column, because four of
  them now name a different number.
- **Logic — four new `ModifierStat`s**, each with the `resolve()` at the call
  site that owns it:

| Stat | Call site | Note |
|---|---|---|
| `recoverySpeed` | `harvest.ts#effectiveRecoveryMs` | the site **divides** by it |
| `harvestUnitsPerStrike` | `upgrades.ts#effectiveUnitsPerStrike` | reaches the thumb **and** the crew from one place |
| `harvestStock` | `harvest.ts#effectiveStock` | **signature change**: it takes no `state` today, and eight call sites pass it |
| `workerStrikeSpeed` | `upgrades.ts#workerStrikeMs` | the site **voids** `state` today, with a comment saying a stat there would be code and nothing had asked. Something has |

- **`respawnSpeed` is NOT needed.** The Verdant Seal leaves the respawn clock,
  so nothing moves it and the mechanic stays transparent to the player — which
  is the call already taken.
- `workerSpeed` (the walk) and `taxRate` scoped to a district both resolve
  already; the Ledger's scope is the one `effectiveTaxRate(state, district)`
  was built for.
- **Also in this step** — the Gilded Ledger's `Beckon` costs **0 Mana** and is
  the Compass's spell as well. Give it a price; §6 gives it an active of its
  own.
- **Save** — bump, no migrator: a relic's effect is derived from its level.
- **Test** — a relic at level 50 pays more than at level 49; the Seal's `+1`
  reaches a worker's delivery and a player's tap from the same number.

### 1.1 How it landed

- **The Ledger and the Compass kept their numbers.** The proposed cut to ×1.05
  was refused as too hard, so only the Rod, the Seal and the Sigil moved.
- **`ArtifactDef.passive` gained a `stats` list.** The Seal moves two numbers
  and the Sigil moves two, with one shared `base` and `per_level` — which is
  the design saying the pair must move together, not a convenience.
- **`effectiveStock` took a `state`**, as expected, across eight call sites.
- The relic card now reads a **speed** as *"…recover 300% faster"* rather than
  *"+300%"*, which was true and said nothing.

## 2. Eight relics exist, as passives

- **Data** — three rows on `Artifacts`; `ArtifactId` grows from five to eight
  (a union in `state.ts`, so this half is code).

| Relic | Stat | Call site | Live? |
|---|---|---|---|
| **The Delver's Lantern** 🏮 | `roomHaul` | `expeditions.ts#roomReward`, wallet line only | **yes** |
| **The Muster Horn** 📯 | `armyCap` | `army.ts#armyCap` | **yes** |
| **The Bailiff's Tally** 🧾 | `worldImprovementYield` | the world map's hourly grant | **no** |

- **Logic** — `roomHaul` is one new `ModifierStat` and one `resolve()` around
  the room's Gold and Stone. `armyCap` already resolves. `worldImprovementYield`
  is declared and read by nothing until the world map lands.
- **UI** — **the requirement that cannot be skipped**: a relic card shows an
  effect the build cannot deliver in **muted ink with its reason**, the way an
  unfound relic's chip is already padlocked
  ([`../features/09-relics.md`](../features/09-relics.md) §11.3). A card that
  promises *"+15% from every improvement you hold"* on a kingdom with no world
  map is lying to somebody who spent an album on it.
- **Save** — bump, no migrator: `artifacts.levels` is keyed by id and an absent
  id reads 0.
- **Test** — every relic's stat resolves at a live call site, or is on a named
  pending list of exactly one.

### 2.1 How it landed

- **`ArtifactDef` gained `pending`**, a reason string or null, and the relic
  card prints it above a muted effect.
- **Three relics have no album yet.** Eight relics and five albums means the
  Lantern, the Horn and the Tally are reachable from `?dev` and nowhere else,
  and a relic card shows *First Furrow* as its album because `albumOfRelic`
  falls back. **Step 4 closes both**, and a test names the gap so it cannot be
  mistaken for a bug.

## 3. The packs, the chests and the stars

Self-contained, and the step whose numbers are already measured.

- **Data** — the `Packs` sheet is reshaped: `cards`, seven `guarantee_*`
  columns and seven `weight_*` columns replace five weights plus `gold_chance`
  and `gold_guaranteed`. Nine rows: Verde, Amarillo, Rosa, Azul, Púrpura,
  Dorado, and the three chests. The star ladder (2 · 6 · 16 · 40 · 100 · 80 ·
  200) moves onto `Collection`.
- **Logic** — `packCards()` deals the guarantees first and rolls the remainder
  on seven ways; `starsFor` reads the ladder instead of deriving it; the vault
  gains a third threshold and a **ten-chest batch** (the ten-call's argument:
  buying in bulk buys time, not a better price).
- **Fix while in there** — Bronce is dominated by Silver at 150 against 250:
  it is the cheaper sticker and the dearer real price. It wants ~105.
- **UI** — the vault knob's three tiers, the batch button, and the store
  shelf's published odds re-derived from the new shape.
- **Save** — bump **and a migrator**: a pending pack carries a tier id, and the
  old four are gone.
- **⚠ The rng changes.** A pack's cards hash on its id *and the order of its
  rolls*, so changing how many rolls a pack makes changes every pack already
  banked. Harmless now; a migration after launch.
- **Test** — every pack always holds what it guarantees; the published odds
  sum to 100 over the faces it can deal, with a guarantee counting as its whole
  slot; and **every chest costs more stars than its own contents return**,
  which is arithmetic rather than balance.

### 3.1 How it landed

- **Nine ids, in English**: `Green Yellow Rose Blue Purple Golden` and
  `BronzeChest SilverChest GoldChest`. The Spanish names and the `Gold`
  collision — a pack, a chest and the gold editions all called the same thing —
  were settled before they reached the sheet. A tier id is not hashed, so a
  rename stays free.
- **Bronce is 105 stars, not 150.** At 150 it was dominated: Silver had the
  dearer sticker and the cheaper real price (70 net against 78) and paid twice
  as much per 4★.
- **The ruins pay the free ladder now** — a room a Green, a boss a Rose, a
  bottomed ruin a Purple — and the code says what they are: fifteen depths
  cleared once is a **welcome, not a supply**, and the season's 200 come from
  the repeatable dungeon (**OQ-102**).
- **The vault knob opens a shelf** instead of buying. With three chests and a
  ten-at-once there is a choice, and a one-press knob could not say what it was
  about to spend.
- **A pack's name and promise are GENERATED from its row**, so a retuned sheet
  cannot leave a stale promise on a shelf.
- **One design consequence to notice**: the card bundles moved from the old
  Star pack to **Purple**, which guarantees a 5★ rather than a gold edition. So
  [`09-relics.md`](../features/09-relics.md) §6.1's *"every bundle is star
  packs, so every pack in one carries the gold guarantee"* **no longer holds**.
  Either a bundle gains a Golden alongside its Purples, or the line goes.

## 4. Eight albums, and the pairing rotates

- **Data** — `seasons.ts` grows to **eight albums of nine cards**, with the
  authored rarity ladder (§6.4 of the cycles proposal). They need **names and
  card names**, which is content, not balance.
- **Logic** — `AlbumDef.relic` becomes `relicOfAlbum(album, occurrence)`,
  derived: `ARTIFACT_ORDER[(albumIndex + occurrence) mod 8]`. Sixteen call
  sites read `.relic` and take the season instead.
- **UI** — the medallion grid goes from three-and-two to **three, three and
  two**, and the album's reward band names a relic that changes each season.
- **Save** — bump **and a migrator**: `collection.cards` is keyed by `AlbumId`
  and the old five ids are gone. Dropping unknown keys is correct — the close
  wipes cards anyway.
- **Test** — five... **eight** consecutive seasons give every relic every rung
  exactly once.

## 5. The album cycle

- **Logic** — closing an album **spends its nine cards** (duplicates survive);
  `completed` resets when all eight are in it; a `cycle` counter rides beside
  it so a payout knows its lap. The collection prize and the albums' Gems are
  the **first lap's only**; a repeat pays the production chest, the keys and
  the relic level.
- **UI** — the album screen says which lap it is on.
- **Save** — bump **and a migrator**: `cards` now means *unspent* cards.
- **Test** — the loop terminates; a reset with cards in hand does not
  re-complete on the same tick.

## 6. Zones, cooldowns and the actives

**Gated on OQ-98.** The largest step and the only one that can be cut whole.

- **Logic, in this order:**
  1. **Zones** — a placed, timed, positional effect: new state, a save field,
     an expiry `consider()` in `nextBoundary`, and a `resolve()` that knows
     about cells. It must satisfy invariant 1, so its expiry is a boundary and
     no effect is ever integrated across a straddled window.
  2. **Cooldowns** — one timestamp per relic and the ACTIVE → COOLDOWN → READY
     walk, the cooldown counted from the window's **close**.
  3. **The auto-tap engine** — a tap budget spent four a second, nearest-first,
     charging no Mana. The one exception to *every player tap costs 1 Mana*,
     and the level moves the exchange rate.
  4. **The eight actives**, five on the city grid and three on their own
     surface.
- **Data** — `active_*` columns per level on `Artifacts`, and which axis each
  relic's level moves.
- **UI** — the cast-mode preview on the map (the grid lights what a zone would
  cover before the tap is spent) and the three-state chip on the relic card.
- **Save** — new state and a bump.
- **Two of the eight actives wait on the world map**, and land with it.

## 7. The art

Runs alongside every step. **Around twenty sprites, five sheets.**

| Sheet | What | Needed by |
|---|---|---|
| **A** | 3 relics — Lantern 🏮, Horn 📯, Tally 🧾 | step 2 |
| **B–C** | 8 album medallions | step 4 |
| **D–E** | 6 packs (Verde → Dorado) and 3 chests | step 3 |

- **The pipeline is the proven one** ([`../art/sprite-prompts.md`](../art/sprite-prompts.md),
  and the two memory notes it descends from): ChatGPT driven through Chrome,
  **2×2 sheets**, anchored on a `magick montage` of what already ships in
  `src/render/assets/` with *"your output will sit next to these; match them"* —
  not on `reference.png` alone.
- **Iterate the style on sheet A only, then say "locked".** Expect round one to
  come back ¾-isometric even with the 80° camera in the first message; the
  correction only lands when it is repeated alone.
- **Say the subject is a card object, not a map tile.** Relics, medallions and
  packs all appear inside a card, which changes the framing.
- **Nothing may cross the canvas midlines** — ask for a clear 40 px band, or a
  quadrant spills and has to be hand-cut.
- **End every prompt with *"no hagas comprobaciones ni correcciones del canal
  en código"***, take the download link from the message body (never the
  image's own editor, which bakes the checkerboard), then unbake locally with
  `Docs/art/originals/v3-sheets/unbake_checkerboard.py` and normalise with
  `norm_sq.fish`. Verify: corner `srgba(0,0,0,0)`, alpha mean below 0.5.
- **Budget ~8 minutes a sheet**, and the shell is fish.

### 7.1 The 72 card faces are not in this plan

Eight albums of nine is **72 faces**, which is a larger job than everything
above it put together. The bridge already shipped: a card's face is drawn as
its **album's medallion** until they are painted, and the layout is the same
either way. Eight medallions buy the whole collection a look; the 72 are their
own programme.

## 8. What this plan does not own

| | Owned by | What it blocks here |
|---|---|---|
| **The repeatable dungeon** | its own programme | **165 of the free player's 200 packs a season** (**OQ-102**). Until it exists the faucet is 35 a season and a free player closes **1.1 albums of 8** |
| **The world map** | [`../features/19-world-map.md`](../features/19-world-map.md) | the Tally's passive and two of the eight actives. They land declared and muted (§2) and pay when it ships |
| **Trading** | the social layer (**OQ-89**) | nothing here; it makes duplicates worth more |

- **The collection can ship complete and still not work**, because its faucet
  is somebody else's step. That is the single most important thing on this
  page: **steps 1–7 make the collection exist; the repeatable dungeon makes it
  play.**
