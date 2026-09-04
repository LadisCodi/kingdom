# 15 · The social layer

> **Scope.** Identity, daily help, a persistent guild, a weekly collective bar,
> and the siege that clears the four defended landmarks. Ingredient trading is
> [`09-relics.md`](09-relics.md) §6; investing research points into a guild
> structure is [`07-research.md`](07-research.md) §8.
>
> **Status: designed, not built.** The game has no social mechanic today.
> Prototype population is five to ten named playtesters.

## 1. The server

| Concern | Authority |
|---|---|
| City simulation, economy, delves, events | client |
| Save | per-player |
| Neighbours, guilds, help, collective bars | **server** |
| Purchase-intent log, telemetry | **server** |

- Shared tables are readable but never directly writable.
- Every mutation is a server-side function that validates, applies the cap and
  returns the new state. One per action: set a display name, create a guild,
  join, leave, list neighbours, give help, contribute, drain effects, commit
  units, resolve a siege.
- Every mutation is idempotent, keyed on a client-supplied id. A retry cannot
  double-spend a daily action or double-count a contribution.

### 1.1 The limit

- The server validates the rules of the social layer: caps, membership,
  monotonic counters.
- It does not validate a city's economy. The sim runs on the client, so a
  client can inflate what it contributes. Accepted for the prototype.
- The sim stays pure (injected clock, hash RNG in integer arithmetic) so it can
  move to the server later.

### 1.2 Server effects and the deterministic sim

- Server effects are drained at load, **before** the offline advance.
- A drained effect enters the state as an ordinary modifier with an explicit
  expiry: a live command with a definite timestamp. After it lands the replay
  is pure again.
- Same position as the event catalogue, which merges into state at load,
  before the replay.
- Nothing writes into another player's save.

## 2. Identity

- One anonymous account per browser (built).
- A **display name**, chosen once, unique-ish.
- **Optional email linking** on the anonymous account, for recovery. The
  *just play* path survives.
- Not in scope: avatars, friend requests, chat, moderation.

## 3. Neighbours and daily help

- Needs no guild; it runs on a list.
- **The list:** the player's guild plus a rotating handful of other active
  players, served by the server. The client never enumerates the user table.
- **The cap:** one help per target per 24 h, five targets per day. Enforced
  server-side, idempotent.
- **The helper is paid immediately:** Mana, priced in seconds of the helper's
  own production, plus event points while an event is running.
- **The target receives a gift:** a pending effect drained at next load (§1.2),
  applied as a **build-speed modifier** for a fixed window.

### 3.1 Only your own state, plus a queued gift

- Helping changes only the helper's state and queues a gift for the target.
- No presence required. A gift is not instant.
- Build speed is one of the modifier stats [`13-events.md`](13-events.md) §1
  adds.
- **OQ-34.**

## 4. The guild

- **Persistent.** 10 members for the prototype.
- Two roles: leader and member.
- One guild per player.
- **No chat.**

### 4.1 Cooperative bar; league deferred

- The prototype ships the cooperative bar (§5.2).
- League (designed, not built): a guild's weekly score is the bar's final
  value; the league is a table of those with promotion and relegation.
- **OQ-33.**

## 5. The guild week

- A timeline template, not a new scheduler: a recurring window with a hard
  deadline, the same shape as the weekly event (48 hours on a 7-day period)
  with a longer duration.
- Stable occurrence ids; phases persist so it cannot pay twice; reconciliation
  before the offline advance.
- The server keys the bar on the occurrence id, so client and server agree on
  which week it is without a clock negotiation.
- The week closes at its deadline.

### 5.1 Contributions

Submitted as they happen:

| Contribution | Weight |
|---|---|
| A **Wonder level** bought | its Gold cost |
| A **delve depth** extracted | depth × tier |
| A **landmark** claimed, a **ruin** first-cleared | flat, large |
| Resources **donated** to the guild | a fraction of the city's hourly rate |
| A **help** given | flat, small |

- Weights are priced against the contributor's own production rate, not in
  absolute units, so a Townhall-1 and a Townhall-3 player contribute
  comparable shares of their capacity.

### 5.2 The bar and the chests

- One **collective bar** per guild per occurrence.
- **Chests at thresholds**, paid to every member the moment the threshold is
  crossed, not at the close.
- The bar **resets** with the next occurrence. Chests already paid stay paid.
- Server-side the bar is a **monotonic counter**: a decrease is refused, and
  each contribution carries an id so a retry is a no-op.

## 6. The siege

- Four of the ten landmarks are **defended**: claiming is gated on a cleared
  flag. The siege writes that flag. The 100,000-Gold far ring sits behind them.
- A player **commits units** to a defended landmark. Committed units are
  unavailable for delves.
- At the week's deadline the **sum of committed power** is scored against the
  landmark's authored threat with the delve scoring pass: same type chart,
  same safe-depth-style preview. A well-prepared siege never fails.
- Success: the cleared flag is written for every contributor, and everyone who
  committed gets the **+10 Mana cap**.
- Failure: the units come home; the siege is available next week. Nothing is
  lost.
- One command; contributor count 1 to 10. A solo player clears a landmark
  alone over several weeks; a guild clears it in one.
- No synchronous play, no battle screen.
- A route into the content chain that does not require a hero.
- **OQ-35.**

## 7. Ingredient trading

- Rules: [`09-relics.md`](09-relics.md) §6.
- Born with a cap, a window, and **3★ either untradeable or one per event**.
- **OQ-10.**

## 8. Exit gate

- Two playtesters in one guild each see the bar move because of what the other
  did.
- The daily help cap holds against a client that calls it twice for the same
  target, and against a client that replays the same contribution id.
- A gift given while the target is offline is applied exactly once when they
  return, and the replay property still holds with a drained gift in the state.
- A siege committed by one player over three weeks clears the same landmark a
  guild clears in one.
- No client can read the contributions of a guild it is not in.

## 9. Deliberately not in this design

- Chat
- Avatars and friend requests
- A leaderboard at prototype population
- Raiding or looting of any kind ([`02-map-scopes.md`](02-map-scopes.md) §4)
- Writing into another player's save
- A live-presence requirement
- The sim on the server

**Open questions:** OQ-10, OQ-33, OQ-34, OQ-35, OQ-36, OQ-37, OQ-38, OQ-39.
