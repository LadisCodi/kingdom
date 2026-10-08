# Audio wishlist

Sounds the game still needs, in priority order. Drop files into
`src/audio/sounds/` with EXACTLY these names (wav or mp3 both fine — the
registry in `src/audio/sfx.ts` handles either) and say the word; each gets
a volume + pitch-jitter entry and its call site. Keep SFX short (< 1s
unless noted); they play over the music loop at ~0.35–0.55 volume.

**Status: everything below has been delivered and wired** (2026-09-01) —
this doc now serves as the sound map. `tab_empty` was renamed `tap_empty`;
the ambience files use the provided `ambiance_*` spelling. Still open:
`chain_finished` (victory sting for claiming the final quest).

Also in: `pop-06` (collect/boost taps) · `button_click` (all UI buttons)
· `discovery` (default banner chime) · `quest_claimed` · `research_started`
· `music-harp-peaceful-loop` · `text_tick_01`/`_02` (dialogue typing).

## Tier 1 — core feedback (silent moments players notice)

| File | Plays when | Character |
|---|---|---|
| `error_denied` | Can't afford (currency shake), invalid action toasts | Soft double-buzz / dull "uh-uh", not harsh — it fires often early on |
| `tap_empty` | Tapping an exhausted cell (the 💤) | Muffled thud/whiff — "nothing here" |
| `reveal_paid` | Each fog tap that pays gold toward a cell | Tiny coin tick / chisel tap (hearable 3–5× in a row) |
| `reveal_done` | A fog cell fully REVEALS | Short shimmer/whoosh — a mini discovery, lighter than `discovery` |
| `build_placed` | A world build started, a repair | Single hammer thunk + wood knock |
| `quest_complete` | The quest pill turns green (goal met, BEFORE claiming) | Bright objective "ding" — distinct from `quest_claimed` |
| `villager_trained` | +1 👥 lands | Small cheer / cork-pop / bell |

## Tier 2 — flavor

| File | Plays when | Character |
|---|---|---|
| `research_complete` | Research finishes (its banner) — replaces the generic chime there | Short fanfare, bigger than `research_started` |
| `construction_complete` | A build/upgrade finishes (its banner) | Hammer flourish + "ta-da", medium |
| `upgrade_bought` | Buying a tech-tree upgrade circle | Ascending "power-up" blip |
| `gem_spend` | Any gem purchase (rush, Knowledge) | Crystalline "ching" — premium feel |
| `unit_trained` | Recruiting an army unit | Sword shing / drum hit |
| `boat_splash` | A fishing boat departs the Docks | Small water plop (quiet — recurring) |

## Tier 3 — ambience (loops, later)

| File | Plays when | Character |
|---|---|---|
| `ambience_meadow` (loop) | Camera over grass/plains, under the music | Birds, light wind, ~30–60s seamless loop |
| `ambience_coast` (loop) | Camera near water | Gentle waves, gulls |
| `ambience_snow` (loop) | Camera over the frozen isle | Cold wind |
| `chain_finished` | The final quest is claimed (one-shot) | Proper victory sting, 2–3s |

Notes: `worker_deposit` and per-tax coin ticks were considered and skipped —
they fire many times a minute and would fatigue fast; the floaters carry
that feedback. If we ever want them, they need heavy rate-limiting.


---

## Wanted by the 2026-09-02 design pass *(not yet needed — designs only)*

Grouped by the doc that introduces them. Nothing here blocks implementation; the
existing SFX fallback behaviour applies.

### Magic — [`features/08-magic.md`](features/08-magic.md)

| Cue | When |
|---|---|
| `mana_full` | The pool reaches cap — a soft chime, **not** an alarm. Overflow is a missed opportunity, never a failure |
| `spell_cast_divination` | Fog dissolves off a cell |
| `spell_cast_bloom` | Exhausted cells recover in a radius |
| `spell_cast_haste` | A timed buff begins |
| `artifact_attuned` | A relic drops into a slot |
| `artifact_locked` | A swap is refused because the slot is still in its 5-minute lock |
| `landmark_claimed` | Mana production rises |

### Expeditions — [`features/11-expeditions.md`](features/11-expeditions.md)

| Cue | When |
|---|---|
| `delve_depart` | A party launches |
| `depth_cleared` | A depth resolves — the checkpoint's arrival beat |
| `delve_extract` | The haul banks safely. This is the reward sound and should feel like relief |
| `delve_failed` | A push fails and half the haul is lost. **Deliberately understated** — the design frames this as a bet declined, not a punishment, and a harsh sting would undo that framing |
| `ruin_discovered` | A ruin comes out of the fog |
| `unit_recruited` | Replaces the instant-recruit cue once training takes time |

### Heroes and gacha — [`features/10-heroes.md`](features/10-heroes.md)

| Cue | When |
|---|---|
| `pull_common` / `pull_rare` | Escalating, with the rare cue distinct enough to be recognised before the art resolves |
| `fragment_gained` | A duplicate converts |
| `tier_up` | Fragments raise a tier cap |
| `hero_levelled` | Knowledge spent |

### Events

| Cue | When |
|---|---|
| `window_open` / `window_close` | A scheduled window — no event is authored today |

**Tone note.** The audit's positioning is cozy: nothing here should read as a
threat. `delve_failed` and `mana_full` are the two cues most likely to be
mis-designed as alarms, and both should be soft.

## The battle playback

`src/audio/sounds/battle_<name>[_NN].ogg`, cut from the sound collection
(silence trimmed, a tail fade, mono, a hit levelled by mean, a stinger to
−16 LUFS); `_NN` takes alternate at random. They are not fetched at boot:
`warmBattleSfx()` brings them down when a deploy sheet opens, or when a
fight's playback does. The mix is `BATTLE_MIX` in
`sfx.ts`; `tests/battleSounds.test.ts` holds every name to a file.

| Name | Plays when | Source |
|---|---|---|
| `battleStart` | The armies march on | Battle Viking Horn Call |
| `swordHit` · `lanceHit` · `cavalryHit` | A Warrior's (or melee hero's) · Lancer's · Cavalry's blow lands | Sword Hits Type 2 · Spear Pierce Through Flesh (Heavy Edgy) · Body Hit Punch Kick Fight |
| `cavalryCharge` | A cavalry line sets off | Horse Snort |
| `arrowLoose` · `arrowHit` | An archer looses · an arrow (or a bolt) lands | Bow Crossbow Arrow Shoot Type 1 · Wood Hit |
| `boltCast` | A ranged hero looses, a care skill is cast | Light Wand Whoosh |
| `squadDown` · `skullStamp` · `heroDown` | A ring cracks · its skull lands · a hero falls | Swing Hit Wood Shield Break · Pixel Thud · Body Fall |
| `skillCharge` · `ribbon` | A skill charges · its ribbon unrolls | Pixel Skill Ready · Cloth Movement Fast |
| `volley` · `cleave` · `crush` · `ambush` · `sharpshot` | That skill | Mass Loose · Big Sword Hit · Rock Impact Heavy Slam · Pixel Phase Swish · Rapid Shot Critical |
| `heal` · `shieldUp` · `shieldSoak` · `shieldBreak` · `daze` | A heal lands · a shield goes up, soaks, shatters · a daze | Pixel Simple Heal · Pixel Bubble Deflect · Metallic Bubble · Glass Small · Charm |
| `warCry` · `bulwark` · `vigour` | A rally is named | Bravery · Shield Buff V1 · Heavenly Positive Buff |
| `finalBlow` | The last blow's slow motion | Alien Strike (cinematic) |
| `victory` · `defeat` | The plaque lands | RPG Fanfares · Victory 1 · Defeat 1 Short |

## Music

One track at a time; the highest that is on plays (`src/audio/music.ts`).
All levelled to the harp (−16.6 LUFS); the three moments restart from their
top each time they take over, the harp resumes where it was.

| Track | Plays while | Source |
|---|---|---|
| `music-tavern-loop` (feast) | A chest is being opened | Tavern (loop), sound collection |
| `music-battle` | A fight plays back, until its plaque lands | *Battlefront Ode*, first 75 s — Owl Theory, Ultimate RPG Music Collection |
| `music-muster` | A deploy sheet is open (a lair's, an army's) — war drums while the party is picked | *Preparing for the Assault*, whole, 2.5 s fade at the tail — same collection |
| The town playlist | Everything else: a random song first, then each in turn, the next crossfading in over the last 5 s | Harp Peaceful (loop), four rounds of it · *Adventurer's Anthem* · *Legendary Age* · *Friendly Folks* — Owl Theory, Ultimate RPG Music Collection |

## The chest's cards, the world board, magic

Cut like the battle's (a hit levelled by mean, a stinger to −16 LUFS), one
file each in `src/audio/sounds/`.

| Name | Plays when | Source |
|---|---|---|
| `cardImpact` | Any card but a whole hero turns face up | Drum Hit 01 |
| `cardRevealCommon` · `cardRevealRare` · `cardRevealLegend` | On top of it, by the card's rarity (a skip keeps only the hit for a common) | RPG Fanfares Pick Up Coin (four takes) · Item Get 1 Short · Fairy Magical 01 |
| `barFill` | A fragments bar fills | Count Prize Long |
| `explorerDepart` · `explorerHome` | An explorer sets out · comes home | Harpsichord Level Start · Level Complete |
| `armyMarch` · `armyRecall` · `armyHome` | An army marches · is called back · comes home | Battle Intro 1 Short Drums Only · Horn 01 · Quest Complete Short |
| `tribute` | A camp is paid off | Coins in Sack Dropped on Wood |
| `raidAlarm` | A lair's garrison came down on the city | Battle Viking Horn Call Far |
| `speedup` | A speed-up takes time off a wait | Clock Tick (four takes) |
| `spellCast` · `relicWake` | A world relic's spell · a city relic woken | Casting Magic · Arcane Symbol Activate |

## The placement ghost

Peak-normalised to −3 dB, one file each in `src/audio/sounds/`. Alternatives
are auditioned on the Ghost Bench artifact.

| Name | Plays when | Source |
|---|---|---|
| `ghostLift` | A ghost appears, a finger takes it, a long press lifts a building | Pop 09 |
| `ghostStep` | The ghost takes a cell (pitched down onto illegal ground); a move cancelled | Wood Block Sticks Hit Clap 01–03, cut to 0.16 s |
| `ghostPlant` | Build or Move confirmed | Impact Deep Thud Bounce 03 under Hitting Nail with Hammer 01 |

A confirm on illegal ground plays `error`.

A world build started or finished sounds as a city one does (`buildPlaced`,
`constructionComplete`). A news whose event already sounded — a build, an
explorer or army home, a raid — arrives in the notices column without the
`pop`.
