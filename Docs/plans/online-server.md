# Plan — the real server

> **What this is.** The steps from the world board's local stand-in and the
> cloud save to a real server on Supabase, and then the social layer
> ([`../features/15-social.md`](../features/15-social.md)) on top of it.
>
> **Status: steps 3 and 5 built.** The game uses the real server
> when the cloud is configured (`?world=local` keeps the stand-in).

## 1. Steps

| # | Step | What changes |
|---|---|---|
| 1 | **The door** | every world request goes through `handleWorld` (`src/worldServer/handle.ts`); the server keeps the time; command ids; effects sent until acknowledged; the player's id is the signed-in user; `npm run server:bundle` |
| 2 | **The world server** | a `world` edge function and a `boards` table on the Supabase project the cloud saves already use; `RemoteWorldServer` beside the stand-in; the client picks one by env |
| 3 | **Seating** | a player is on no board until they first go out; then a nickname, and a rival's city on a shared board (19 §1.3) |
| 4 | **Accounts** | optional email linking (15 §2) |
| 5 | **Friends** | the `social` edge function and its tables; the friends list (15 §2.1) |
| 5b | **Neighbours and help** | 15 §3 |
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

- **Runtime:** the `world` edge function (Deno) wraps `serveWorld`
  (`src/worldServer/serve.ts`), bundled by `npm run server:bundle` into
  `supabase/functions/_shared/world.js`. The bundle is checked to reach for
  no browser API (`tests/serverBundle.test.ts`).
- **Storage** (`supabase/migrations/`): one row per board — `boards (id,
  doc jsonb, version, bots)` — one per seated player — `seats (user_id,
  board_id, seat)` — and one per nickname — `profiles (user_id, nickname)`,
  unique on its lower case.
- **A request:** the user from the JWT; read the player's board and its
  version; `handleWorld` at the function's clock; write it back only if the
  version is unchanged (`update_board`), else start again on the newer board,
  up to five times.
- **A first join:** the nickname reserved (`claim_nickname`, which keeps a
  player's first one); the newest board with a rival left (`open_board`)
  written back with the player in that rival's seat (`take_seat`), else a
  new board `b-<user>` and its seat (`create_board`).
- **A malformed request** is refused before it is read; one that throws is
  refused and nothing is written.
- **Dev "play as"** reaches only the rivals' seats on the real server.
- **Rivals:** resolved when the board is read, as today. No scheduled job.
- **Access:** neither table is readable by the client. Everything goes
  through the function, which answers with a snapshot cut for that seat.

## 3.1 The social server

- **Runtime:** the `social` edge function wraps `serveSocial`
  (`src/socialServer/serve.ts`), bundled into the same
  `supabase/functions/_shared/world.js` as the world's.
- **Storage:** `profiles` gains `code` (unique), `townhall`, `cells`,
  `seen_at`; `friend_requests (from_id, to_id)` one way;
  `friendships (user_id, friend_id)` kept both ways.
- **A request** is `{ cmd }`: the user from the JWT, `serveSocial` at the
  function's clock. Every command is idempotent by what it says, so a retry
  needs no command id.
- **The cap holds under a race:** `befriend` locks both profiles in a fixed
  order before it counts.
- **Access:** RLS on, no policy; only the function reads or writes.
- **The client** (`src/socialServer/remote.ts`) tries a request three times;
  one that never gets through is refused as `Offline`. Without a cloud, or
  with `?world=local`, a stand-in in the browser peoples the list with a
  dozen made-up kingdoms (`src/socialServer/local.ts`).

## 4. The client

- `RemoteWorldServer` (`src/worldServer/remote.ts`) sends each command with
  one id up to four times, waiting longer each time. One that never gets
  through is refused as `Offline`.
- The board is read every 5 s on the world screen, every 30 s elsewhere; a
  read waits for the one before it.
- At load the client only asks where the player sits. The first time out,
  an unseated player is asked a nickname; joining seats them and goes out.
- A connect that fails leaves the player off the board; the next read asks
  again.
- On a join, an army the save has out that the server does not hold comes
  home whole.

## 5. Deploying

```bash
npx supabase db push            # the tables
npm run server:bundle
npx supabase functions deploy world
npx supabase functions deploy social
```

- Anonymous sign-ins on (Authentication → Sign In / Up).
- `.env.local` with the project URL and anon key turns the game onto it.

## 6. What the client still decides

- The city, its economy and what it pays for a world command
  (15 §1.1). The server trusts the board an army sets out with and the
  payment a claim or a tribute was made with.
- A command's direct payout (a collect, a trade) rides on its answer. A
  retry with the same id is answered again, so a lost answer is recovered by
  retrying; an answer never retried is lost.

## 7. Deliberately not in this design

- The city simulation on the server
- Live push of board changes — a player sees others' moves on the next read
- More than one board per edge function call
- Splitting a board's document into tables
