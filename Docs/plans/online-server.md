# Plan — the real server

> **What this is.** The steps from the world board's local stand-in and the
> cloud save to a real server on Supabase, and then the social layer
> ([`../features/15-social.md`](../features/15-social.md)) on top of it.
>
> **Status: step 1 built.** The world server's door, its protocol and its
> bundle exist and run against the local stand-in.

## 1. Steps

| # | Step | What changes |
|---|---|---|
| 1 | **The door** | every world request goes through `handleWorld` (`src/worldServer/handle.ts`); the server keeps the time; command ids; effects sent until acknowledged; the player's id is the signed-in user; `npm run server:bundle` |
| 2 | **The world server** | a `world` edge function and a `boards` table on the Supabase project the cloud saves already use; `RemoteWorldServer` beside the stand-in; the client picks one by env |
| 3 | **Seating** | a player joins a shared board in a free or bot seat instead of a board of their own |
| 4 | **Profiles** | a display name, chosen once; optional email linking (15 §2) |
| 5 | **Neighbours and help** | 15 §3 |
| 6 | **Guilds** | 15 §4 |
| 7 | **The guild week** | 15 §5 |

- Each step is a branch and a PR into `develop`, and leaves the game
  playable. With no Supabase env the game runs on the stand-in, as today.

## 2. The protocol

- **One door.** A request is `{ opId, playerId, ack, asSeat?, cmd }`; the
  server answers it with `handleWorld(world, request, now)`. The stand-in and
  the edge function call the same function.
- **The server keeps the time.** A request carries no time. Every snapshot
  carries the server's (`at`). The client keeps its own clock on the
  server's: `Game.now()` is the device's time plus `clockOffset()`, guessed
  from the quickest recent round trip (`clockSync.ts`).
- **A command runs once.** The client makes `opId` once per command and sends
  it again on a retry. A seat's last 32 answered commands are kept with their
  answer; a repeat gets that answer with a fresh snapshot.
- **What the server owes is sent until saved.** Each effect carries `seq`,
  counted per seat. It rides out with every answer to its player until a
  request's `ack` reaches it. The client applies the effects past its
  `effectSeq`, saves, and only then acknowledges.
- **Who asks.** `playerId` is the signed-in Supabase user; without a cloud,
  an id made once per device. On the real server it is read from the JWT,
  never from the request.
- **Not on the wire:** `devShift`. A dev time-warp moves only the stand-in.

## 3. The world server on Supabase

- **Runtime:** an edge function (Deno) running the bundle `npm run
  server:bundle` writes to `supabase/functions/_shared/world.js`. The
  bundle is checked to reach for no browser API (`tests/serverBundle.test.ts`).
- **Storage:** one row per board — `boards (id text primary key, doc jsonb,
  version int, updated_at timestamptz)` — and one per seated player —
  `seats (user_id uuid primary key, board_id text)`.
- **A request:** read the user from the JWT; `select … for update` the
  player's board row; `handleWorld` at the database's `now()`; write the row
  back; answer. One board is one lock, so two players on a board are served
  one after the other.
- **Rivals:** resolved when the board is read, as today. No scheduled job.
- **Access:** neither table is readable by the client. Everything goes
  through the function, which answers with a snapshot cut for that seat.

## 4. What the client still decides

- The city, its economy and what it pays for a world command
  (15 §1.1). The server trusts the board an army sets out with and the
  payment a claim or a tribute was made with.
- A command's direct payout (a collect, a trade) rides on its answer. A
  retry with the same id is answered again, so a lost answer is recovered by
  retrying; an answer never retried is lost.

## 5. Deliberately not in this design

- The city simulation on the server
- Live push of board changes — a player sees others' moves on the next read
- More than one board per edge function call
- Splitting a board's document into tables
