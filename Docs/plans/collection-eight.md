# Plan — the eight-album collection

> **What this is.** The step-by-step order in which the three proposals land:
> [`../proposals/relic-effects.md`](../proposals/relic-effects.md) (what the
> relics do), [`../proposals/album-cycles.md`](../proposals/album-cycles.md)
> (eight albums, the rotation, the cycle) and
> [`../proposals/collection-packs.md`](../proposals/collection-packs.md) (the
> packs, the chests, the stars). It owns the **sequence**; the designs stay in
> `proposals/` until each step closes and moves them into `features/09`.
>
> **Status: ALL SEVEN STEPS DONE, 2026-09-15.** Save version 57. All three
> proposals have landed and are folded into
> [`../features/09-relics.md`](../features/09-relics.md).
>
> **Two of the eight abilities are not built, and that is the plan rather than
> a shortfall**: The Call and The Levy are cast on the world map, which does
> not exist ([`../features/19-world-map.md`](../features/19-world-map.md)).
> They land with it. Their relics say so on their own cards, in muted ink with
> the reason — §2's rule, which is the one thing about them that could not
> wait.
>
> **What the collection still needs is not on this page.** It is complete and
> it does not yet play: 165 of the free season's 200 packs come from the
> repeatable dungeon, which is somebody else's programme — **OQ-102** (§8).

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
| ~~**4**~~ | ~~Eight albums, and the pairing rotates~~ **done** | 2, 3 | **M** |
| ~~**5**~~ | ~~The album cycle~~ **done** | 4 | **M** |
| ~~**6**~~ | ~~Zones, cooldowns and the actives~~ **done** (six of eight abilities; two wait on the world map) | ~~OQ-98~~ **closed**, 2 | **L** |
| ~~**7**~~ | ~~The art~~ **done** | — (ran alongside) | **M** |

- **1 and 3 are independent** and can go in either order or at once.
- **1 grew from S to M** once the proposal was read against the build: four of
  the five relics change which number they move, not just its sign.
- **6 is the only large one**, and the only one left.

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
- **Test** — eight consecutive seasons give every relic every rung exactly
  once; the ladder climbs; and no two cards share a name.

### 4.1 How it landed

- **Eight albums, 72 cards**, on the authored rarity ladder: *First Furrow ·
  The Wild Wood · Hands at Work · Market Day · The King's Coin · Under the
  Hill · The Long March · The Star Road*. The theme climbs with the difficulty
  — soil, wood, craft, market, coin, the deep, the war, the heavens — so which
  album a player closes says what they were able to open. 45 of the card names
  were already written and are reused; 27 are new.
- **`AlbumDef` lost its `relic`.** `relicOfAlbum(album, occurrence)` replaces
  it, derived as `ARTIFACT_ORDER[(albumIndex + occurrence) mod 8]`.
- **The rotation lives in `collection.ts`, not `seasons.ts`.** The album set
  and the relic roster are declared in two files that already point one way,
  and a pairing importing both would close the loop.
- **Both step-2 gaps are closed**: every relic has an album in every season,
  and no relic card falls back to *First Furrow*.
- **The tests needed a deterministic `close(album)`** — hold eight and lay the
  ninth with a wildcard. A 72-slot season means a two-card pack cannot be
  relied on to deal a named card, and what those tests are about is the payout
  rather than the odds.

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

### 5.1 How it landed

- **The spend is what makes the loop terminate**, and it is the whole step: a
  close that left the page full would re-close it on the very next tick, for
  ever. Duplicates survive the spend, so a hoard is worth holding.
- **`seasonIsComplete` stopped being exported.** `completed` empties the
  instant the lap rolls, so it is true for exactly as long as it takes
  `completeIfDue` to ask it. What outlives the lap is `prizePaid`, and that is
  the fact the UI and the tests want.
- **The ladder was five rungs long and the album list was eight.**
  `albumRewards` falls back to the first band, so the three hardest pages were
  quietly paying a beginner's chest and **no key at all** — a step-4 gap
  nothing caught. The workbook now authors eight: hours `2 2 4 4 6 8 8 8`,
  and one key a page, silver ×5 then gold ×3. A test refuses a ladder shorter
  than the album list.
- **The Gems stayed at 2,000 an album**, so a first lap of eight pays 16,000
  rather than the old 10,000 of five. The season asks for 60% more cards, so
  the rate per card falls slightly — which is the right direction.
- **Save 50, with a real migrator**: `cards` now means *unspent* cards, and a
  pre-lap save carries both a full page and its entry in `completed`. The nine
  are spent on load, once per completed album, exactly as the close would have
  spent them.
- **The docs caught up in this commit.** Steps 3 and 4 left
  `features/09-relics.md` describing five albums, 45 cards and four pack
  tiers; §3, §4, §5, §6, §7, §11 and §12 are now the build, and §5.1 is the
  lap.

## 6. Zones, cooldowns and the actives

**OQ-98 closed in the relics' favour on 2026-09-15**, so this is live. The
largest step, and now the only one left.

The deciding argument was what a relic is FOR: the collection asks a player for
nine cards a page, and a relic whose ability lived in the Magic tome would be
**a passive with a picture** — nothing those cards buy that the player ever
presses. Magic keeps `Resonance` and the Mana cap, which make every relic's
active better without owning any of them.

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

### 6.1 How it landed

- **A zone is a MODIFIER WITH A CENTRE**, not the `sim/zones.ts` this planned.
  The modifier stack already expired, pruned, saved and folded in a defined
  order; the only thing it could not say was WHERE. So its expiry is still
  `expiresAt`, which is already a `consider()` in `nextBoundary` — invariant 1
  holds without a line of new boundary code.
- **`resolve()` is blind to zones and `resolveAt()` is not.** That asymmetry is
  the safety: a Foreman's Sigil leaking into the cell-blind read would speed up
  every crew in the kingdom.
- **The cooldown is deliberately NOT a boundary.** It gates a COMMAND; nothing
  accrues differently across it, unlike a zone's expiry.
- **The auto-tap run lands whole, at the cast.** Its cells, budget and rate are
  fixed the moment the spell is paid for, so ticking it would produce the same
  answer more slowly — and one-call replay would have to be argued rather than
  being true by construction.
- **Three abilities changed SUBJECT**, because a relic is one idea at two
  speeds and three of them were two ideas. Divination paid a cell's fog while
  the Rod's passive was recovery; Beckon called a resource back while the
  Compass's passive was Stardust; Bloom cleared exhaustion, which is the Seal's
  own passive said twice and worse.
- **An ability may be counted in EVENTS.** Lamplight is rooms, not minutes, and
  has no clock at all — which meant a cast must not stamp a cooldown, or the
  relic would come back READY with charges in hand.
- **A zone had to be visible.** §11.6: a tint on every covered cell, a wheel on
  the centre alone, and four decals (`spr-x`). The first pass buried the
  kingdom under violet — a zone TINTS rather than covers.
- **One bug found by the zone rather than caused by it**: the recovery bar
  divided by the AUTHORED wait, so it opened nearly full under anything that
  speeds recovery up — the Dowsing Rod's passive alone did it. A cell now keeps
  the LENGTH of the wait beside its end.

## 7. The art

Ran alongside every step. **Fifteen sprites, three sheets** — not the twenty in
five this planned, because a 3×3 grid holds nine.

| Sheet | What | Needed by |
|---|---|---|
| ~~**A**~~ | ~~3 relics — Lantern 🏮, Horn 📯, Tally 🧾~~ **done** (`spr-t`) | step 2 |
| ~~**B**~~ | ~~8 album medallions~~ **done** (`spr-u` — only 3 were missing) | step 4 |
| ~~**C**~~ | ~~6 packs (Green → Golden) and 3 chests~~ **done** (`spr-v`, all nine in one 3×3) | step 3 |

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
- **End every prompt asking for the alpha correction** — *"The background must
  be alpha 0 everywhere, not white, not a checkerboard. Then apply the
  true-alpha transparency correction and give me the download link for the
  corrected PNG."* That one sentence is the difference between a real `srgba`
  PNG and a baked checkerboard; the older advice said the opposite and cost
  every sheet an unbake. Say **no drop shadows** too. Download by fetching the
  `<img>`'s own `src` to a blob from the page's own JS — the export menus do
  not fire through the extension. Then normalise with `norm_sq.fish` (2×2) or
  `norm_box.fish` (any grid). Verify: corner `srgba(0,0,0,0)`, alpha mean below
  0.5. `unbake_checkerboard.py` is still there for a sheet that comes back
  baked anyway.
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
