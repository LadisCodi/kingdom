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
· `music-harp-peaceful-loop`.

## Tier 1 — core feedback (silent moments players notice)

| File | Plays when | Character |
|---|---|---|
| `error_denied` | Can't afford (currency shake), invalid action toasts | Soft double-buzz / dull "uh-uh", not harsh — it fires often early on |
| `tap_empty` | Tapping an exhausted cell (the 💤) | Muffled thud/whiff — "nothing here" |
| `reveal_paid` | Each fog tap that pays gold toward a cell | Tiny coin tick / chisel tap (hearable 3–5× in a row) |
| `reveal_done` | A fog cell fully REVEALS | Short shimmer/whoosh — a mini discovery, lighter than `discovery` |
| `build_placed` | Confirming Build (construction starts) | Single hammer thunk + wood knock |
| `quest_complete` | The quest pill turns green (goal met, BEFORE claiming) | Bright objective "ding" — distinct from `quest_claimed` |
| `villager_trained` | +1 👥 lands | Small cheer / cork-pop / bell |
| `coin_sale` | Selling at the Market | Coin pouch / register "ka-ching" |

## Tier 2 — flavor

| File | Plays when | Character |
|---|---|---|
| `research_complete` | Research finishes (its banner) — replaces the generic chime there | Short fanfare, bigger than `research_started` |
| `construction_complete` | A build/upgrade finishes (its banner) | Hammer flourish + "ta-da", medium |
| `upgrade_bought` | Buying a tech-tree upgrade circle | Ascending "power-up" blip |
| `gem_spend` | Any gem purchase (rush, research slot) | Crystalline "ching" — premium feel |
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
| `conjunction_open` / `conjunction_close` | The weekly window |

**Tone note.** The audit's positioning is cozy: nothing here should read as a
threat. `delve_failed` and `mana_full` are the two cues most likely to be
mis-designed as alarms, and both should be soft.
