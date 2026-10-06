# 15 · The social layer

> **Scope.** Identity, the friends list, daily help, a persistent guild, a
> weekly collective bar, and the co-op siege that clears the world map's
> landmarks. Card trading is
> [`09-relics.md`](09-relics.md) §8; investing research points into a guild
> structure is [`07-research.md`](07-research.md) §8.
>
> **Status: identity, email linking, the friends list, the crest, the
> Inbox, the wish board and daily help built (§2–§3); the rest
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
- **Optional email linking**, in Settings › Your kingdom. The *just play*
  path survives.
  - **Link:** an email, then the six-digit code sent to it, typed in the
    game. The email is the kingdom's from then on.
  - **Sign in**, on another device: the email, then its code. That device
    plays the linked kingdom; the one it had is dropped, and said so before
    the code is asked for when it was not linked.
  - An email already linked to a kingdom cannot link another.
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
  door). A red orb counts requests to answer, unread Inbox messages and
  friends' wishes the player can fill.
- **The cap:** 10 friends, held on both sides. At most 10 requests waiting
  for an answer at once.
- **Requests expire** after 48 hours unanswered, on both sides.
- **On the world map:** a friend on the same world has their city, name
  and ground shown through the fog ([`19-world-map.md`](19-world-map.md)
  §1.3).
- **The name first:** the name is asked for the moment the world map opens,
  after its splash and its scene ([`19-world-map.md`](19-world-map.md)
  §1.3); taking it seats the kingdom on a board. One name, unique, never
  changed, the save keeps it. The friends list never asks.
- **Three tabs:** *List*, *Trade* (§2.4) and *Inbox* (§2.3). A red seal on
  Trade counts the friends' wishes the player can fill; on the Inbox, its
  unread messages.
- **The List, top to bottom:**
  - **The player's own card**, pinned: their place among their friends
    (ribbon), crest, name, Townhall tag, friend code (a tap copies it), and a
    pencil that opens the crest editor (§2.2). It stays put; everything
    under it scrolls.
  - **Friend requests**, one list:
    - received: *Sent you a friend request*, the time left, ✕ and ✓;
    - sent: *Awaiting response…*, a turning ring; no cancel;
    - suggested: *Suggested friend*, a + that sends a request.
    - Suggestions only fill the list to 3 rows, and never past the room
      left for friends. Empty: *No pending requests*.
  - **Share** and **Search** under it.
    - *Share* sends a message with the player's code and a link
      (`?friend=<code>`) through the phone's share sheet, else the
      clipboard. Opening the link opens the search popup with the code in.
    - *Search* opens the search popup.
  - **Friends n/10**, ranked with the player by Townhall level, then by cells
    revealed; the player's own place is on their card, not in the list. The
    first three wear a gold, silver or bronze ribbon with their place; the
    rest a plain one. Each row: crest, name, Townhall tag, last seen.
- **The screen** takes the whole height between the header and the nav.
- **The Townhall tag:** the Townhall icon and level on a pill coloured by
  band of two levels — 1-2 green, 3-4 teal, 5-6 blue, 7-8 purple, 9-10 orange.
- **Last seen**, roughly: *Online now* (under five minutes), *Today*,
  *Yesterday*, *This week*, *n weeks ago*, *n months ago*.
- **The search popup:** one field for a kingdom's whole nickname (any case)
  or its friend code.
  - A cross in the field until what is typed has a nickname's or a code's
    shape, a tick once it has; *Add* is off until then.
  - *Add* sends the request: *Sending request…*, then *Friend request sent*
    and *Awaiting response from X*.
  - Refused: the reason under the field (*There is no kingdom with that name
    or code*, *Your friends list is full*…), the field crossed and *Add*
    off until the text changes.
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

### 2.3 The Inbox

Modelled on Theme Park's Inbox (ITP-009/26, the send and receive pages).

- **Two sections:** *New messages* and *Old messages*, newest first. Each
  row: the sender's crest and name, what it says, how long ago.
- **What arrives:**
  - a friend request: *Sent you a friend request*, the time left, ✕ and ✓.
    Answered here or on the list, it says so (*You accepted…* / *You
    declined…*, a tick or a cross); unanswered, it expires;
  - the answer to a request the player sent: *Accepted your friend
    request* or *Declined your friend request*;
  - the wish board's news (§2.4), each with what moved: *Filled your wish*,
    *You filled their wish*, *Nobody filled your wish* (its stake came back).
  - Sending a request writes nothing to the sender's Inbox. A cancelled
    request leaves the other's.
- **Read:** opening the tab reads what is new; it moves under *Old* on the
  next visit, stamped with when it was read. A request waiting for an answer
  stays new until it is answered.
- **Kept 30 days**, then gone. *Delete read* clears every old message.
- Other systems add their own kinds.

### 2.4 Trading: the wish board

Friends trade the three precious materials and relic fragments on a wish
board: a player pins what they need and what they give for it, and any
friend who has it fills it in one tap. Modelled on Clash Royale's requests
and Township's help, with the rules of Idle Town Master's *Comercio*.
Mockups: [`../art/ui/mockups/m77-wish-board.png`](../art/ui/mockups/m77-wish-board.png),
[`m78-wish-steps.png`](../art/ui/mockups/m78-wish-steps.png).

- **A lot:** a precious material ×5, one relic piece, or one keystone.
- **One lot for one lot:** material for material or piece, piece for piece
  or material; **a keystone only for a keystone**; never the same thing
  both ways.
- **A fragment is wished for only if missing** — a relic met and not yet
  restored, none held in that slot. Never a spare to level with.
- **A fragment is given only if duplicated** — at least two in its slot,
  one kept — and found, never bound.
- A fragment received by trade is found. A wish whose stake is a fragment
  of a relic the player has never met cannot be filled by them: the first
  fragment of every relic is found by play.

**The Trade tab:**

- *Your wishes n/3*: each *I need → I give*, the time left, a ✕ to take it
  down (its stake comes back); *+ Make a wish* while fewer than three.
- *Friends need*, with *Fills n/5*: every friend's open wish, the ones the
  player can fill first and lit (*You have it*, **Fill**); the rest greyed
  with why (*You don't have it*, *You have only one*, *You have not found
  this relic yet*).

**Making a wish**, two windows one after the other:

1. *What do you need?* (step 1 of 2) — one relic a row, every relic met and
   not restored, its six slots across it: held ones faded, missing ones
   dashed and pickable, the keystone the sixth and gold-rimmed. Under them,
   the three materials ×5. A need already wished for is greyed.
2. *What will you give?* (step 2 of 2) — the need on top with *Change*;
   *Your duplicates*, every fragment held, the ones that cannot go greyed
   with why (*Only 1*, *Keystone only*); the materials ×5. *Held until a
   friend fills it, or for 48 hours.* **Pin wish**: the stake leaves the
   player's goods.

**Filling:** **Fill** gives what the wish needs and takes its stake, at once.
*Wish filled!* shows who, what went and what came; both players get an
Inbox message.

**Rules on the server:**

- Up to **3** wishes at once; never the same need twice.
- **5 fills in any 24 hours**; pinning and receiving are not capped. The
  filler gets nothing beyond the stake.
- A wish stands **48 hours**, then its stake comes back. Withdrawn, at once.
- A wish is filled once, by one friend: the fill is one conditional write.
- Every lot that lands on a player — a filled need, a filled wish's stake, a
  stake back — is a **delivery**, numbered; the client applies each once,
  saves, and acknowledges the last with its next hello.

| Dial, in the order to reach for them | Where |
|---|---|
| The cap on friends, on requests waiting | `?dev=data` › Friends (`friends.max`, `friends.maxSent`) |
| A material's lot | `trade.materialLot` |
| Wishes at once, fills a day, a wish's hours | `trade.wishes`, `trade.fillsPerDay`, `trade.wishHours` |
| How long a request waits, a message is kept | `friends.requestHours`, `friends.messageDays` |
| Rows the requests list fills with suggestions | `friends.requestRows` |

## 3. Daily help

- **Who:** the player's friends (§2.1). Needs no guild.
- **Where:** a **Help** button on each friend's row in the List; the head
  of the friends section counts the helps left (*Helps 4/5*). A friend
  helped shows *Helped · again in …*.
- **The cap:** each friend once in any 24 hours; five friends in any 24
  hours. Enforced by the server.
- **The helper is paid on the server's yes:** Mana, ten minutes of their
  own Mana regeneration, at least 1, up to the pool's ceiling.
- **The friend gets a gift:** a construction speed-up (5 min) in the Bag,
  and an Inbox note (*Helped your kingdom*). The gift is a delivery
  (§1.2): applied once, at the next answer from the server.
- **Dials** (`?dev=data` › Friends › friendHelp): `perDay`,
  `helperManaMinutes`, `giftItem`.

### 3.1 Only your own state, plus a queued gift

- Helping changes only the helper's state and queues a gift for the target.
- No presence required. A gift is not instant.
- **OQ-34**, closed.

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

**Open questions:** OQ-89, OQ-33, OQ-36, OQ-37, OQ-38, OQ-39.
