# 23 · Tutorials — the First Morning, the introductions and the help

> **Scope.** How the game teaches: the one scripted stretch at the start (the
> **First Morning**), the **introduction** every other system gets the first
> time it opens, the **help** that comes when the player is stuck, and the
> **input lock**. What opens when is [`22-progression.md`](22-progression.md);
> how a line is drawn is [`24-dialogue.md`](24-dialogue.md); the quests the
> beats follow are [`12-quests.md`](12-quests.md) §2.
>
> **Status: designed 2026-10-01; built on `feat/ftue`.** Every line below is
> data in `?dev=data` › Progression › **Scenes**.

## 1. The rules

1. **The quest chain teaches; the advisor speaks.** A beat never asks for
   anything the active quest does not.
2. **One scripted stretch**: the First Morning, quests 1–7, about ten
   minutes. It is the only place input is locked.
3. **Every other system is introduced once**, the first time its door opens,
   by a short scene the player taps through.
4. **Help is asked for, or earned by being stuck.** After the First Morning
   nothing points unprompted.
5. **A scene plays once per kingdom**, and the save remembers it.
6. **A scene waits its turn.** It never starts over the battle playback, the
   gacha reveal, the rewarded video or a sheet the player opened — unless the
   sheet is what the scene is about. Scenes due at once queue in authored
   order.
7. **A scene can be skipped** — every one but the First Morning carries a
   **Skip** knob.

## 2. Three kinds of guidance

| Kind | Blocks | Moves on | Used for |
|---|---|---|---|
| **Beat** | everything but its target | when its condition is met | the First Morning |
| **Introduction** | everything, until tapped through | a tap per line | a door opening, a first event |
| **Hint** | nothing | the player acts, or it times out | the quest pill, idle help |

## 3. The First Morning

Played on the real kingdom, from the first frame after the payer profile. The
camera starts on the Townhall. **Isolde**, the Royal Advisor, speaks from the
left unless a line says otherwise.

| # | Quest | Isolde says | Points at | Lock | Moves on |
|---|---|---|---|---|---|
| 0.1 | — | *Your Majesty! Welcome home to Oakville — or to what the fog has left of it.* | — | all | tap |
| 0.2 | — | *I am Isolde, your Royal Advisor. I keep the maps, the ledgers and, on good days, the peace.* | — | all | tap |
| 0.3 | — | *The fog swallowed everything past the Townhall. But fog, like most things in this kingdom, can be bought back.* | — | all | tap |
| 1.1 | `FirstSteps` | *See the trees in the dark? Tap that patch. Five taps clear a cell, and every tap costs a pinch of Gold.* | the nearest fogged forest | that cell | the cell is revealed |
| 1.2 | `FirstSteps` | *Timber! Clear three more forest cells — the scroll keeps count.* | the next fogged forest | the map | the quest completes |
| 1.3 | `FirstSteps` | *A task done is a reward waiting. Tap the scroll.* | the quest pill | the pill | claimed |
| 2.1 | `Woodcraft` | *Our woodcutters have forgotten their craft. The Book of Civics will remind them.* | **Research** (its padlock breaks) | the tab | the book is open |
| 2.2 | `Woodcraft` | *Every card in the book is a technology. This one teaches us to fell trees.* | the Forestry card | the card | its sheet is open |
| 2.3 | `Woodcraft` | *Research runs on Knowledge. Pour it in…* | **+N** | the button | the Knowledge is in |
| 2.4 | `Woodcraft` | *…then pay the Gold, and it is ours at once.* | **Research** | the button | Forestry is done |
| 2.5 | `Woodcraft` | *Knowledge refills by itself — a point an hour, up to ten. Pour it in before the bar is full, or the drip stops.* | the Knowledge tab | all | tap |
| 2.6 | `Woodcraft` | *Close the book and let's put it to use.* | the close knob | the knob | the book is shut |
| 3.1 | `Timber` | *Tap a tree. Every tap on the ground spends one Mana — the blue gauge up top.* | the nearest forest | the map | three taps |
| 3.2 | `Timber` | *Hold your finger down and the axe keeps swinging.* | — | none | the quest completes |
| 3.3 | `Timber` | *Claim it — the Mana it pays is exactly what you just spent.* | the quest pill | the pill | claimed |
| 4.1 | `ARoof` | *Nobody settles in a town without roofs. Let's build a House.* | **Build** (its padlock breaks) | the tab | the build menu is open |
| 4.2 | `ARoof` | *Buildings are paid for up front. Pick the House.* | the Housing card | the card | placing |
| 4.3 | `ARoof` | *Anywhere on cleared ground. Drag it if you like, then confirm.* | the confirm button | the map and the panel | placed |
| 4.4 | `ARoof` | *A builder is on it. Buildings keep rising while you are away.* | the construction | all | tap |
| 5.1 | `Rations` | *Villagers eat. Berry bushes give Food — tap them.* | the nearest berries | none | the quest completes |
| 6.1 | `FirstVillager` | *The Townhall trains villagers. Open it.* | the Townhall | the Townhall | its card is open |
| 6.2 | `FirstVillager` | *Train one. They'll need that roof.* | **Train** | the button | a villager arrives |
| 6.3 | `FirstVillager` | **Villager** (right): *A roof, a hearth and a monarch! I'll pay my rent on time, Your Majesty.* | — | all | tap |
| 7.1 | `TaxDay` | *Housed villagers pay rent into the House's store. When the bubble shows, tap it — collecting is always free.* | the House | none | the quest completes |
| 7.2 | `TaxDay` | *That is the heart of it: clear the fog, gather, build, grow. The scroll will always hold your next task.* | the quest pill | all | tap |
| 7.3 | `TaxDay` | *Lost? Tap the scroll and I'll point the way. And come back each day — there is a gift waiting.* | the daily chest (it appears) | all | tap — **the First Morning ends** |

- **A beat checks its condition when it starts**, so a beat already met is
  skipped, and a reload mid-morning resumes at the first unmet beat.
- **A lock releases itself** if its target is missing for five seconds; the
  beat then shows as a hint. Nothing can strand the player.
- The camera flies to a map target before the beat's line appears.

## 4. The introductions

Each plays once, the first time its trigger is true. Lines are tapped through;
**Skip** ends the scene. A scene that points at something does so after its
last line, as a hint.

### 4.1 The village

| Scene | Trigger | Speakers | Says | Then points at |
|---|---|---|---|---|
| `workers` | quest `ToWork` reached | Isolde | *A Farm sends workers out to the plots around it. Give it a hand or two — they walk, harvest and carry home to the Farm's store.* | the Farm's workers |
| `townhall2` | quest `ProperCapital` reached | Isolde | *A bigger Townhall lets us pay for fog further out — the dotted line is how far. It also lets the city hold more.* | the Townhall |
| `builders` | every builder busy, for the first time | Isolde | *Every builder is busy. Wait, or hire another hand — the builder's hut takes Gems.* | the builder plaque |
| `manaEmpty` | the Mana pool reaches 0, for the first time | Isolde | *Out of Mana. It refills on its own, about a pool a night — or a short message from our patrons refills it now.* | the Mana gauge |
| `eras` | 30 cells revealed | Isolde | *The deeper pages of the books only open to a monarch who has seen more of the land. You just have — Chapter II is open.* | Research |

### 4.2 The Orcs

| Scene | Trigger | Speakers | Says | Then points at |
|---|---|---|---|---|
| `orcs` | the Orcs are discovered | **Grukk** (right), Isolde, **the Warden** (right) | **Grukk:** *Grrr. Your town smells of bread and gold. We come for both.* · **Isolde:** *Orcs! While their camp stands they'll raid our stores — and nothing near it can be worked.* · **Warden:** *Warden of the Guard, Your Majesty. Give me soldiers and I'll drive them out.* · **Isolde:** *The Book of Warfare is open to us now. Start with the Barracks.* | the raid widget |
| `raid` | the first raid lands | Isolde | *They hit the stores — never the treasury. Collect often and they find less. Clear the camp and we get every coin back.* | the lair |
| `battle` | the first attack sheet opens | the Warden | *Pick who goes in: me in a hero slot, soldiers in the others. The numbers tell you how it'll go before we march.* | the attack button |
| `victory` | the first lair is cleared | the Warden, Isolde | **Warden:** *They're scattered! And look what they left behind.* · **Isolde:** *Claim the camp — whatever they took comes back, and the ground is ours again.* | the lair |
| `relics` | Relics opens | Isolde | *Cards! Collect a page of them and the kingdom earns a relic — a gift that keeps growing every season.* | Relics |

### 4.3 Magic, heroes, the world

| Scene | Trigger | Speakers | Says | Then points at |
|---|---|---|---|---|
| `magic` | the first landmark is claimed | Isolde | *Feel that? Old stones still hum with power — our Mana pool is deeper already. The Book of Magic is open.* | Research |
| `tavern` | the first Tavern is finished | **Bess** (right), Isolde | **Bess:** *Doors open, fire lit, soup on! Heroes will come from every road for a bowl of this.* · **Bess:** *And me? I'm not bad with a ladle in a scrap, either.* · **Isolde:** *The Tavern hosts the banner — your first call is on the house. And a new book: the Sagas.* | Heroes |
| `watchtowerSeen` | the Watchtower is discovered | Isolde | *An old watchtower, north. From its top you could see past the mountains — to whoever else is out there.* | the Watchtower |
| `world` | the Watchtower is claimed | Isolde | *Other kingdoms, Your Majesty. Other banners. The roads out are being scouted — and the Atlas will help us read them.* | the world knob |

### 4.4 Later systems

| Scene | Trigger | Says (Isolde) |
|---|---|---|
| `wounded` | the first soldier comes home wounded | *Wounded, not lost. The Infirmary patches them up for a fraction of a new recruit.* |
| `workshops` | the first workshop is finished | *A workshop turns raw goods into refined ones. The highest building levels ask for them.* |
| `harmony` | the first decoration is unlocked | *A beautiful city is a willing one. Decorations lend Harmony, and grand buildings ask for it.* |
| `daily` | the daily chest opens | *One gift a day you visit. Miss a day and nothing is lost — the next gift simply waits.* |

## 5. Help when stuck

- **The quest pill is the help button.** A tap on an unfinished quest flies to
  its target and points at it — the existing hint — and the pointer stays
  until the player taps the target or twenty seconds pass.
- **Idle help**, while the chain is in the opening (up to `Attuned`):

| Idle for | What happens |
|---|---|
| 30 s | the quest pill wiggles |
| 60 s | Isolde leans in from the left edge: *Need a hand?* — a tap shows the hint |
| after | she hides after ten seconds, and does not return for three minutes |

- Idle means no command and no open sheet while the active quest is
  unfinished. Panning the map is not a command.
- Past `Attuned` the pill still wiggles; Isolde stays away.
- **A refusal explains itself.** A tap on a padlock says what opens it; a
  refused build, research or tap says why, as it does today.

## 6. The input lock

| Lock | Taps reach |
|---|---|
| `none` | everything |
| `target` | the beat's target only — the map cell, or the one control |
| `all` | nothing but the dialogue |

- **Panning and zooming the map are never locked.**
- A lock draws a scrim over everything but a cut-out round the target, and
  the pointer bobs at the target.
- **A lock never outlives its beat**, and releases itself after five
  seconds with no target (§3).

## 7. What the save keeps

- The scenes played, by id. The beat of the First Morning is not saved: it
  is derived from the quests on load (§3).
- A save from before this design is read as having played every scene.

## 8. Dials, in the order to reach for them

| Dial | Value | Where |
|---|---|---|
| Every line, speaker, side and box position | §3–§4 | `?dev=data` › Scenes |
| Which scene plays on which trigger, and in what order | §3–§4 | `?dev=data` › Scenes |
| Idle wiggle · idle advisor · her rest | 30 s · 60 s · 3 min | `scenes` settings (`help.*`) |
| How long a pointer waits | 20 s | `help.pointerSeconds` |
| When idle help stops | quest `Attuned` | `help.untilQuest` |
| The lock's failsafe | 5 s | `help.lockFailsafeSeconds` |

## 9. Deliberately not in this design

- A skippable First Morning, or a skip for the whole tutorial.
- A tutorial on a separate map, a sandbox, or a replay of the opening.
- Rewards for watching a scene.
- Choices in dialogue, or branching scenes.
- A pointer that appears without being asked after the First Morning.
- Voice, and an animated portrait beyond entering, leaving and dimming.
- A scene over the battle playback, the reveal or the rewarded video.
- Re-playing a scene from the settings.

**Open questions:** **OQ-117**.
