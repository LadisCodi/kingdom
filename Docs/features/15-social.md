# 15 · The social layer

> **Scope.** Identity, the friends list, daily help, a persistent guild, a
> weekly collective bar, and the co-op siege that clears the world map's
> landmarks. Card trading is
> [`09-relics.md`](09-relics.md) §8; investing research points into a guild
> structure is [`07-research.md`](07-research.md) §8.
>
> **Status: identity, the friends list and the crest built (§2–§2.2); the rest
> designed, not built.** Prototype population is five to ten named
> playtesters.

## 1. The server

| Concern | Authority |
|---|---|
| City simulation, economy, events | client |
| The world board — claims, armies, dungeons ([`19-world-map.md`](19-world-map.md)) | **server** |
| Save | per-player |
| Friends, neighbours, guilds, help, collective bars | **server** |
| Purchase-intent log, telemetry | **server** |

- Shared tables are readable but never directly writable.
- Every mutation is a server-side function that validates, applies the cap and
  returns the new state. One per action: set a display name, create a guild,
  join, leave, list neighbours, give help, contribute, drain effects, commit
  units, resolve a siege.
- Every mutation is idempotent, keyed on a client-supplied id. A retry cannot
  double-spend a daily action or double-count a contribution.
- The server keeps the time. A request carries none; the client keeps its
  clock on the server's.
- The protocol and the steps to the real server:
  [`../plans/online-server.md`](../plans/online-server.md).

### 1.1 The limit

- The server validates the rules of the social layer: caps, membership,
  monotonic counters.
- It does not validate a city's economy. The sim runs on the client, so a
  client can inflate what it contributes. Accepted for the prototype.
- The sim stays pure (injected clock, hash RNG in integer arithmetic) so it can
  move to the server later.

### 1.2 Server effects and the deterministic sim

- Server effects are drained at load, **before** the offline advance.
- An effect is sent with every answer until the client acknowledges it, and
  the client acknowledges only what it has saved. Each is applied once.
- A drained effect enters the state as an ordinary modifier with an explicit
  expiry: a live command with a definite timestamp. After it lands the replay
  is pure again.
- Same position as the event catalogue, which merges into state at load,
  before the replay.
- Nothing writes into another player's save.

## 2. Identity

- One anonymous account per browser (built). Its id is who the player is to
  the world server (built).
- A **nickname**, chosen the first time out onto the world map, unique and
  never changed ([`19-world-map.md`](19-world-map.md) §1.3) (built).
- **Optional email linking** on the anonymous account, for recovery. The
  *just play* path survives.
- A **friend code**: eight letters in two fours (`K7QD-M2XA`), handed out by
  the server the first time anyone needs it; no 0/O or 1/I.
- A **crest**, chosen by the player (§2.2); until then the one its nickname
  picks, the same everywhere.
- Not in scope: avatars, chat, moderation.

### 2.1 The friends list

Modelled on Theme Park's friends list (ITP-009/26). Mockup:
[`../art/ui/mockups/m73-friends.png`](../art/ui/mockups/m73-friends.png).

- **The door:** a knob hanging under the header, left of Settings. It opens
  once the world map is open and the kingdom has a nickname (the `friends`
  door). A red orb counts requests to answer.
- **The cap:** 10 friends, held on both sides. At most 10 requests waiting
  for an answer at once.
- **The name first:** the name is asked for the moment the world map opens,
  after its splash and its scene ([`19-world-map.md`](19-world-map.md)
  §1.3); taking it seats the kingdom on a board. One name, unique, never
  changed, the save keeps it. The friends list never asks.
- **The screen, top to bottom:**
  - **The player's own card**, pinned: their place among their friends
    (ribbon), crest, name, Townhall tag, friend code, and a pencil that opens
    the crest editor (§2.2). It stays put; everything under it scrolls.
  - **Requests**, three tabs: *Received* (accept / decline), *Sent*
    (cancel), *Suggested* (add). A red seal counts the received and the sent.
  - **Search** by friend code or by the start of a nickname; up to five found.
  - **Invite:** the player's code on a brass plate (a tap copies it) and
    *Invite*, which shares a message with the code and a link
    (`?friend=<code>`) through the phone's share sheet, else the clipboard.
    Opening the link searches the code the first time the list can.
  - **Friends n/10**, ranked with the player by Townhall level, then by cells
    revealed; the player's own place is on their card, not in the list. The
    first three wear a gold, silver or bronze ribbon with their place; the
    rest a plain one. Each row: crest, name, Townhall tag, last seen.
- **The screen** takes the whole height between the header and the nav.
- **The Townhall tag:** the Townhall icon and level on a pill coloured by
  band of two levels — 1-2 green, 3-4 teal, 5-6 blue, 7-8 purple, 9-10 orange.
- **Last seen**, roughly: *Online now* (under five minutes), *Today*,
  *Yesterday*, *This week*, *n weeks ago*, *n months ago*.
- **Asking someone who already asked you** is a yes.
- **A profile** opens on a tap of a friend's row: crest, name and code,
  Townhall, land revealed, last seen, place among friends; a section of
  actions other systems add (none yet); *Remove* in the corner, behind a
  confirmation.
- **Suggestions:** players on the same world board first, then players seen
  in the last 14 days nearest the player's Townhall; never anyone already a
  friend or asked either way.
- **Progress is reported** by the client with each hello (Townhall level,
  cells revealed) and shown to friends as is (§1.1).
- **Reads:** a hello every 10 s while the screen is open, every 60 s
  elsewhere once the door is open.

### 2.2 The crest

- A blank shield in one of **8 tinctures** with one of **12 charges** on it:
  - tinctures: red, blue, green, purple, black, orange, teal, wine;
  - charges: lion, lily, oak, crown, tower, star, eagle, key, swords,
    dragon, stag, ship.
- **Every combination is free.**
- **The editor:** the crest large, the 8 fields (each with the current
  charge), the 12 charges (each on the current field), *Save*. A tap changes
  the preview; the close X leaves the crest as it was.
- **Where it shows:** the player's card, every row of the friends screens,
  a friend's profile, and the plank under each city on the world map
  ([`19-world-map.md`](19-world-map.md) §1.3).
- **Where it lives:** the save is the player's own; the social server's
  profile gets it with every hello, the world board's seat with a
  `setCrest` command until the board agrees.

| Dial, in the order to reach for them | Where |
|---|---|
| The cap on friends, on requests waiting | `?dev=data` › Friends (`friends.max`, `friends.maxSent`) |
| How many suggestions | `friends.suggestions` |

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
- Build speed is a modifier stat ([`13-events.md`](13-events.md) §1).
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
  deadline on a 7-day period.
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
| A **dungeon depth** cleared | depth × tier |
| A **landmark** claimed, a **lair** first-cleared | flat, large |
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

> **To be redesigned with the social layer.** Written against the delves and
> landmark claims that no longer exist; the world board now comes first
> ([`02-map-scopes.md`](02-map-scopes.md) §7).

- The siege is the **world map's** encounter
  ([`02-map-scopes.md`](02-map-scopes.md) §7): a contested landmark held by an
  authored threat, cleared by a guild. The province's lairs are cleared
  solo, by a hero and a party
  ([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md)); province
  landmarks are claimed for Gold.
- A player **commits units** to a besieged landmark. Committed units are
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
- The one route into combat that does not require a hero.

## 7. Card trading

- Rules: [`09-relics.md`](09-relics.md) §8 — a **one-way gift**, three sends a
  day, receiving uncapped, gold cards never.
- The send is a server mutation on the model of daily help (§3): idempotent,
  capped on the sender, drained by the receiver at next load before the
  offline advance.
- Safe because of the season: a card is wiped at the close, so a spare is
  free to give and pointless to hoard.
- What the trade screen carries beyond the send: **OQ-89.**

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
- Avatars and frames; crests locked behind progress or sold
- A leaderboard at prototype population
- Raiding or looting by another player ([`02-map-scopes.md`](02-map-scopes.md) §5)
- Writing into another player's save
- A live-presence requirement
- The sim on the server

**Open questions:** OQ-89, OQ-33, OQ-34, OQ-36, OQ-37, OQ-38, OQ-39.
