# UI/UX for the long game — magic, ruins, heroes

> Companion to [`ui-menus-redesign.md`](ui-menus-redesign.md), which set the
> look (parchment and carved wood, bottom sheets over a live map, a reason
> beside every disabled control) and rebuilt the twelve screens that existed.
> This one covers the screens the 2026-09-02 design pass ADDED, the two it
> retired, and the art still owed.
>
> Status: **built** (2026-09-02). Every screen below is in `src/ui/`.

---

## 1. What changed at the top level

Three systems arrived at once — Mana and relics, ruins and delves, heroes and
a gacha — and the temptation with three systems is three destinations. That is
how a cozy builder turns into a launcher with a nav bar full of tabs.

So the rule for this pass was: **a new system earns a destination only if the
player visits it on its own schedule.** Two do; the rest live where they are
used.

| System | Where it lives | Why |
|---|---|---|
| Mana, relics, heroes, the banner | **Reliquary** — a nav tab | Visited every session: Mana fills on a clock and relics are swapped against it |
| Delves | **The ruin's own card**, then a sheet | You go to a ruin because you are looking at it on the map |
| A party waiting | **A pill under the quest tracker** | It is a return hook, not a destination |
| Recruiting units | **The military building's card** | Where villagers are recruited is the Townhall; where soldiers are recruited is the Barracks |
| Casting | **Placement mode** | Select → highlight → tap to commit already existed |

### The Army tab is retired

An army only matters at the moment it is *sent somewhere*. A standing screen
that lists what you own, with a Recruit button, is a spreadsheet of things you
are not currently doing.

So composition moved into the expedition sheet, next to the decision it
serves, and recruiting moved to the building that does it — which is the same
beat the Townhall already had for villagers, complete with a progress bar and
tap-to-hurry. Buildings now behave consistently, and the vacated tab went to
the Reliquary.

That leaves three tabs — **Build · Relics · Research** — with Settings still
the floating knob under the header. Three is the number the redesign settled
on for thumb reach, and this pass did not spend it.

---

## 2. The header

One line was added and it is deliberately the smallest possible one:

```
 [ 18/24 🔮  +4/h ]
```

**A pool and ONE net rate.** Never `+6/h base −4/h upkeep = +2/h`. That
breakdown is genuinely interesting, and it belongs in the Reliquary, on tap,
where the player asked for it — in a status bar it is exactly the spreadsheet
chrome the redesign exists to kill.

Two details carry the mechanic:

- **The fill is a bar, not a number.** What matters is "how close to
  spilling", and a bar answers that without arithmetic.
- **Full is gold-edged.** Overflow is the entire retention mechanic, and it is
  the one state the player should notice across the room.

And it is **not shown until the player has met magic** — a relic owned,
Attunement researched, a landmark claimed, or a landmark simply in sight. A
gauge with nothing to spend on is a counter that teaches nothing. Sticky once
true, the same rule Stone and Iron use in the coin row.

---

## 3. The Reliquary

Three stacked sections, in the order of how often they change:

1. **The pool**, with the breakdown the header refuses to show:
   *Drawn from the land +6/h · Sustaining your relics −4/h · Filling at +2/h*.
   A Gem refill sits under it, priced on what is missing so a full pool costs
   nothing.
2. **The sockets**, large and first, because **the slot is the constraint the
   whole magic design turns on.** An empty socket has to read as an
   opportunity, not a gap — so it is a big dashed frame with a gem outline,
   not a thin grey row. A locked one shows its remaining seconds rather than
   going dead.
3. **Relics and Heroes**, as two tabs of ONE screen, because they share one
   set of rules: Fragments raise a tier cap, Knowledge buys levels within it.
   Two screens would teach the player the same lesson twice and neither would
   feel special.

### An unfound relic is a signpost, not a locked box

`Dowsing Rod — waiting in Hollow Barrow`, greyed, with a padlock. The point of
listing what you do not have is to give the fog somewhere specific to go. A
row that says only "???" gives the player nothing to want.

### The Gilded Ledger's empty ability line is a feature

It has no active at all, and the card says so: *"No ability — it simply works,
always."* Hiding that would make it look broken; stating it is the clearest
proof in the game that the **slot**, not the ability, is what you are spending.

### The banner

Reachable from the Heroes tab, never from the nav bar. A gacha with its own
permanent tab is a different game from this one.

The **pity counter is always visible** — *"Guaranteed within 14 calls"* — and
that is not decoration. Pity is the single thing that makes a gacha read as
fair rather than predatory, and a hidden pity counter is the same as no pity
counter. The copy also states the no-dead-pull rule up front: *"Every miss
still pays fragments."*

---

## 4. Map sites: landmarks and ruins

A landmark or a ruin is drawn where a feature would be, at the same weight as
a forest, with a small corner badge saying what it still wants:

| Badge | Means |
|---|---|
| ✦ | Unclaimed landmark — pay Gold and it is yours |
| ! | Defended landmark — an enemy warband holds it |
| `3` | A ruin, and its tier |

Tapping opens a **site card** in the bottom panel, in the same slot a district
card uses and deliberately reading differently: a district is something you
*built*, a site is something you *found*. So the art is large, there is
exactly one thing to do, and the promise is a headline rather than a stat row:

> **+1 Mana per hour, for good**

Because that is the sentence the whole fog economy rests on. A player who
clears a distance-9 ring and finds one more iron vein has learned that
exploring is a treadmill. A player who finds a shrine that pays forever has
learned the opposite.

The ruin card names the relic waiting at the bottom, its depth count, its full
clear time, and which unit type answers it best — everything the player can
read the moment the fog comes off, before any party exists.

---

## 5. The expedition sheet

**The guaranteed depth is the biggest thing on the screen, by a distance.**

```
   4   Safe to depth 4 of 5
       Past that is a gamble you choose — you will be asked first.
```

"A well-prepared run never fails" is a property of the sim, computed by
assuming the *worst* matchup at every step. But it only becomes a promise the
player can act on if they can read it before they commit. Everything else on
the sheet is in service of that number.

Under it: the party's ATK/DEF/HP, one line on the matchup, the relic on offer,
the hero picker, the troop steppers, and the supply cost.

### It opens pre-filled

The hero is chosen, and the units are picked by which type answers this ruin
best. Nobody should have to assemble a party from nothing just to find out
what a ruin would take — the sheet is an *estimate you adjust*, not a form you
fill in.

### A slot holds a TYPE

The stepper is per unit type and the pip row counts *kinds*, not headcount.
That is what makes the matchup chart a real decision and what "coverage" will
mean when a second hero arrives.

### Standing orders are in plain sight

*Ask me · To depth 4 · To the bottom.* Push-your-luck is the engaged player's
mode; anyone who does not want to be asked sets a depth and leaves. Burying
the opt-out would turn a comfort into a trick.

---

## 6. The checkpoint

One question, and **two answers of equal visual weight.**

```
   [  Take the haul  ]   [  Go deeper  ]
```

Both are primary buttons. The copy carries the difference. Styling *take the
haul* as the safe grey escape and *go deeper* as the exciting gold one is not
asking a question — it is nudging, and a game whose first promise is "nothing
you own is ever taken" cannot afford to nudge here.

Above the buttons, in a warm-red panel, on the FIRST depth rather than after a
loss:

> None of this is yours until they walk back out. A push that fails costs half
> of it.

The 50% bite is legitimate under the design's first promise precisely because
the haul was never property — but that is a technicality unless the UI sells
it up front. A player who learns it by losing will feel robbed, and will be
right to.

And under them, the other half of the bargain:

> They will wait here as long as you like. Nothing expires.

### What is below

Strength and time are authored and public. The **type** is hidden — that is
the gamble, and it is information rather than dice. The Scout's whole trait is
turning that line from *"You do not know what kind"* into an answer, which is
exactly what a management game should sell.

---

## 7. The delve pill

`Waiting at depth 3 of 5 — carrying 12 things they have not brought home yet ›`

A checkpoint never expiring is what stops delves becoming an interruption
engine. But a decision nobody can see is a decision nobody makes, so the
parked party sits under the quest tracker: visible the moment the game opens,
never a modal that demands an answer. It hides while a sheet is up, like the
quest tracker, because map chrome should not compete with what the player just
opened.

---

## 8. Casting

Cast mode **is** placement mode: select, highlight the legal cells, tap to
commit, confirm in a slim bar while the map stays the screen. Reusing it was
the whole reason the two modes were unified rather than built twice.

The one thing the cast bar does that the placement bar does not is
**quantify the outcome before the commit**:

> **320 Gold saved** — the same Mana at any distance

Divination's entire argument is that its flat Mana price beats a Gold curve
that doubles every ring. The player can only weigh Gold against Mana with that
number in front of them, on the cell they are standing on. Bloom gets the same
treatment (*"×7 cells renewed"*), and valid cast targets are outlined in
**blue** so they can never be mistaken for a build spot.

---

## 9. The offline report

`Welcome back` grew the beats that make an absence feel like time passing
rather than a number going up:

- Mana and Knowledge join the resource rows.
- Units that finished training get a row each, counted by type.
- **Things that happened**, in their own list: a Conjunction opened, a party
  reached depth 4, a spell you cast ran its course.

That last group is the point. Deposits and taxes are an amount; a window
opening while you slept is a *story*, and it is the reason the timeline
reports its events at all.

---

## 10. The art

All of it landed on 2026-09-02, in the same ChatGPT conversation as the
original UI set so the whole game still reads as one hand. Provenance, prompts
and the two traps are in [`ui/CONVERSATION.md`](ui/CONVERSATION.md).

| Sheet | Grid | Contents | Treatment |
|---|---|---|---|
| `ui-g-special` | 2×3 | Mana, Sanctum, Barracks, Spear Hall, Shooting Grounds, Stables | atlas icon |
| `spr-a-sites` | 2×4 | 3 landmarks + the 5 ruins | map tile |
| `spr-b-city` | 2×3 | the Sanctum and the four military halls | map tile |
| `spr-c-relics` | 2×3 | the five artifacts | object icon |
| `spr-d-heroes` | 2×3 | the five heroes | full figure |

Three treatments, and the difference between them is the FIRST LINE of each
prompt rather than a setting:

- **Atlas icons** are front-on three-quarter, symbols and objects, and must
  read at 16px. They go through `ui-atlas.mjs build` into the packed atlas.
- **Map tiles** are three-quarter TOP-DOWN, sitting on the ground with a
  contact shadow. They go through `ui-atlas.mjs sprites` into
  `src/render/assets/`, placed on the SOUTH edge of their frame so a building
  meets the tile it stands on.
- **Object icons and figures** use the same sprite path but set
  `"gravity": "center"` — a compass sunk to the bottom of an inventory slot
  reads as a layout bug.

The hero portraits deliberately break the "symbols, not characters" rule, as
the unit portraits already did: a roster wants figures you can recognise and
want, and they are only ever shown at 48px or larger in a framed portrait.
**The rule is about size, not about taste** — and the prompt says so, so the
model does not inherit the earlier rule.

`tests/icons.test.ts` kept an explicit `AWAITING_ART` list while the sheets
were outstanding, so the ask was reviewable in one place rather than hiding in
a green test run; it fails if a name on the list turns out to be drawn, so it
could not rot. It is empty again.
