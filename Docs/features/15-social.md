# 15 · The social layer — neighbours, a guild, and one deadline a week

> **Scope.** Identity, daily help, a persistent guild, a weekly collective bar,
> and the siege that finally clears the four defended landmarks. Ingredient
> trading is [`09-relics.md`](09-relics.md) §6; investing research points into a
> guild structure is [`07-research.md`](07-research.md) §10.
>
> **Status: designed, unstarted.** The largest project in the design.

## 0. What the evidence supports, and what it does not

Stated honestly, because the argument gets overclaimed easily: **the guild stack
does not buy monthly revenue.** Rise of Cultures has all four mechanics and sits
in harvest mode. What the evidence supports is narrower and more useful:

> The two titles in this quadrant with genuinely long lives — Forge of Empires at
> €500M lifetime, Elvenar at €200M — are the two that have run the full stack for
> twelve and nine years. The one that shipped without a persistent guild is the
> floor.

**The stack is not a revenue lever. It is the infrastructure of duration**, which
is the real bottleneck: internal RPD $0.48 against $5.03–5.84 in the quadrant,
with an ARPDAU that already beats Township's. **The problem is months active, not
ARPDAU.**

**Kingdom has no social mechanic of any kind today.** The four that separate the
titles which last from the ones that do not are a persistent guild, a weekly
activity with a hard deadline, a collective bar with chests at thresholds, and
daily help with a cap.

And at prototype population — five to ten named playtesters — this can answer
*do the mechanics work and hold together* and **cannot** answer *does a community
form*. That second question needs strangers.

## 1. The server, and its limit

**The city stays client-authoritative.** The sim is written so it *could* run on
a server — pure, injected clock, hash RNG in integer arithmetic — and that
property is worth keeping, but a prototype that spends six weeks earning trust it
does not need is a prototype that answers nothing.

**What does get server authority is the social layer and the telemetry**, because
those are the two places where a lying client destroys the *data* instead of just
its own save.

| Concern | Authority |
|---|---|
| City simulation, economy, delves, events | client (accepted) |
| Save | per-player |
| Neighbours, guilds, help, collective bars | **server** |
| Purchase-intent log, telemetry | **server** |

The pattern, three rules:

- **Shared tables are readable but never directly writable.**
- **Every mutation is a server-side function** that validates, applies the cap
  and returns the new state — one per action: set a display name, create a guild,
  join, leave, list neighbours, give help, contribute, drain effects, commit
  units, resolve a siege.
- **Every mutation is idempotent**, keyed on a client-supplied id, so a retry on
  a flaky connection cannot double-spend a daily action or double-count a
  contribution.

### 1.1 The limit, said out loud

The server validates **the rules of the social layer** — caps, membership,
monotonic counters. **It does not validate the economy of a city.** The sim runs
on the client, so a player who edits their wallet can inflate what they
contribute. With named playtesters that is acceptable. **In a product it is not,
and the fix is the sim on the server** — which is exactly why the sim's purity is
worth not breaking in the meantime.

### 1.2 How external input reaches a deterministic sim

This is the subtle risk of the whole feature. The sim's load-bearing property is
that **a one-call offline replay equals stepped ticking**, and a gift arriving
from another player is input the replay knows nothing about.

> **Rule: server effects are drained at load, BEFORE the offline advance, and
> enter the state as ordinary modifiers with an explicit expiry.**

That is the same position and the same reasoning as the event catalogue, which is
merged into state at load and before the replay precisely so a window that opened
during an absence still fires. **A drained gift is a live command with a definite
timestamp; after it lands, the replay is pure again.**

**Nothing may write into another player's save.** The permissions forbid it, and
so does the determinism argument.

## 2. Identity

Today each browser gets an anonymous account and **clearing browser storage
orphans the save.** A social layer cannot be built on an identity that
evaporates, and other players need something to call you.

1. A **display name**, chosen once, unique-ish.
2. **Optional email linking** on the existing anonymous account, for recovery —
   so the *just play* path survives.

**Not in scope:** avatars, friend requests, **chat**, moderation. Chat in
particular is a moderation liability a prototype cannot staff, and **none of the
mechanics below need it.**

## 3. Neighbours and daily help

The cheapest retention mechanic in the genre. **A player opens the game, taps
"help" on five villages, and leaves.** Forge of Empires allows one action per
player per 24 h; Elvenar's Neighbourly Help works the same; the 4X titles cut
other people's timers. **It needs no guild — just a list.**

- **The list** is the player's guild plus a rotating handful of other active
  players, served by the server so the client never enumerates the user table.
- **The cap:** one help per target per 24 h, and five targets per day. Both
  enforced server-side, both idempotent.
- **Helping pays the helper immediately** — Mana, which is cheap to grant, always
  wanted, and already priced in seconds of the player's own production so it never
  goes stale — plus event points while an event is running, which is what ties the
  two pillars together.
- **Helping leaves the target a gift, not a mutation:** a pending effect their
  client drains at next load (§1.2) and applies as a **build-speed modifier** for
  a fixed window.

### 3.1 Only your own state, plus a queued gift

*Does helping touch the other player's state, or only your own?* **Only your own,
plus a gift they claim.** It is cheaper, it needs no presence, it cannot corrupt
a save, and it keeps the determinism rule intact. **The cost is that a gift is
not instant, which nobody will notice in a game played in two or three visits a
day.**

Build speed is one of the four modifier stats [`13-events.md`](13-events.md) §1
adds, which is why that widening comes first. **OQ-34.**

## 4. The guild

**Persistent**, 10 members for the prototype, two roles: leader and member. One
guild per player. **No chat.**

### 4.1 Cooperative now, ranked later

*Cooperative, or ranked between guilds?* The design's own line points at ranked —
***the best guild of the week is the best-managed economy*** — which is the
softest form of competition available and coherent with a game that refuses PvP.

**But with five to ten playtesters there is no league**, and shipping a
leaderboard with two entries teaches us nothing and looks broken.

> **Ship the cooperative bar. The league is designed and deferred.**

The design is small once the bar exists: a guild's score for the week *is* the
bar's final value, and a league is a table of those with promotion and
relegation. **OQ-33.**

## 5. The weekly, and why it is nearly free

> **The guild week is a timeline template. Not a new scheduler.**

A recurring window with a hard deadline already ships — 48 hours on a 7-day
period, with stable occurrence ids, phases that persist so it cannot pay twice,
and reconciliation before the offline advance. **A guild week is the same shape
with a longer duration.**

The occurrence id is what the server keys the bar on, which means **client and
server agree on which week it is without a clock negotiation** — the property
occurrence ids were built for in the first place.

### 5.1 What contributes

*The best-managed economy wins the week.* So contributions are **the things a
player was going to do anyway**, submitted as they happen:

| Contribution | Weight |
|---|---|
| A **Wonder level** bought | its Gold cost |
| A **delve depth** extracted | depth × tier |
| A **landmark** claimed, a **ruin** first-cleared | flat, large |
| Resources **donated** to the guild | a fraction of the city's hourly rate |
| A **help** given | flat, small |

**Weights are priced against the contributor's own production rate, not in
absolute units**, so a Townhall-1 player and a Townhall-3 player contribute
comparable *shares* of their capacity. That is the rule every new number follows,
and here it is also **what stops the bar from being a measure of who started
playing first.**

### 5.2 The bar and the chests

- One **collective bar** per guild per occurrence.
- **Chests at thresholds, paid the moment the threshold is crossed**, to every
  member — not at the close. Instant feedback, and **nobody has to be online at
  midnight on Sunday.**
- The bar **resets** with the next occurrence. **Nothing is taken:** chests
  already paid stay paid.
- Server-side the bar is a **monotonic counter**: a decrease is refused, and each
  contribution carries an id so a retry is a no-op.

### 5.3 The deadline is the feature

The promise authorises it in as many words — *pressure comes from opportunity
that expires… never from loss of property.* **A week that does not close is a
checklist.**

## 6. The contested landmark, as the week's first content

**Four of the ten landmarks are marked defended, claiming is gated on a cleared
flag, and nothing ever writes it.** So the 100,000-Gold far ring is unreachable,
and **combat has no job outside a dungeon** — which the design most wants fixed.

*Full expedition sheet, or a lighter pass that spends army power?* **Neither, and
both:**

> **Commit army power to a siege that resolves at the week's deadline.**

- A player **commits units** to the landmark. They are unavailable for delves
  while committed — a real cost, and **the first time the army has to be
  *allocated* rather than merely owned.**
- At the deadline the **sum of committed power** is scored against the landmark's
  authored threat through the same scoring pass a delve depth uses, with the same
  type chart and the same safe-depth-style preview, **so a well-prepared siege
  never fails.**
- If it falls, the cleared flag is written for every contributor and **everyone
  who committed gets the +10 Mana cap.** If not, **the units come home** and the
  siege is available next week. **Nothing is lost.**

Why this is the right shape: **it is one command whose contributor count can be
one or ten.** A solo player can besiege the nearest defended landmark alone over
several weeks; a guild takes it in one. **No second mechanic for the solo case,
no synchronous play required, no battle screen**, and it gives the military
buildings the job outside dungeons the design asked for.

It also fixes the runway problem: a player who never delves makes no collection
progress at all, and **a siege is a second route into the content chain that does
not require a hero.** **OQ-35.**

## 7. Ingredient trading

The first peer-to-peer economy, and the mechanic most likely to be abused by the
very playtesters we need honest data from. Design and rules:
[`09-relics.md`](09-relics.md) §6. **It must be born with a cap, a window, and
3★ either untradeable or one per event**, or the scarcity that makes the world
map worth visiting evaporates in a week. **OQ-10.**

## 8. Build order

Each step is playable before the next exists.

1. **Profiles, display name, optional email linking.** Nothing social yet — but
   **the save stops evaporating, which is worth shipping on its own.**
2. **Neighbours, help, pending effects, draining.** The first social loop, with
   no guild.
3. **Guilds**, membership, a roster screen.
4. **The guild week**: the template, the bar, contributions from the five sources
   in §5.1, threshold chests.
5. **The siege**: unit commitment, resolution at the deadline, the cleared flag
   written.
6. Only then: consider the league (§4.1) — and probably do not, at this
   population.

## 9. Exit gate

- Two playtesters in one guild **each see the bar move because of what the other
  did.**
- The daily help cap **holds against a client that calls it twice** for the same
  target, and against a client that replays the same contribution id.
- A gift given while the target is offline is applied **exactly once** when they
  return, and **the replay property still holds** with a drained gift in the
  state.
- **A siege committed by one player over three weeks clears the same landmark a
  guild clears in one.**
- No client can read the contributions of a guild it is not in.

## 10. Deliberately not in this design

Chat · avatars and friend requests · a leaderboard at prototype population ·
raiding or looting of any kind ([`02-map-scopes.md`](02-map-scopes.md) §5) ·
writing into another player's save · a live-presence requirement anywhere · the
sim on the server.

**Open questions:** OQ-10, OQ-33, OQ-34, OQ-35, OQ-36, OQ-37, OQ-38, OQ-39.
