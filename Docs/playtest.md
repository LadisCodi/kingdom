# Playtest — does the fantasy land?

> **Scope.** How a playtest checks the fantasies the game declares
> ([`overview.md`](overview.md) § *The fantasies*): what is decided before a
> session, what is watched during it, what is asked after it, and how the
> numbers are read when real players are on it. It answers the prototype's
> fourth question (§ *What the prototype is for*).
>
> **Status: protocol, 2026-10-02.** The log signals of §5 are not built.

## 1. Before: the moments

Every fantasy is pinned to the moment of the first sessions that should make
it felt. A playtest watches these moments and no others first.

| Fantasy | Moment | Where |
|---|---|---|
| **Treasure hunt** — the column | the chest that appears beside the first reveal, and the player going for it | beats 1.1b–1.1c ([`features/23-tutorials.md`](features/23-tutorials.md) §3) |
| | the old House: a silhouette past the trees, then found and repaired | beats 4.1–4.3 |
| | a silhouette in the clouds the player sets off towards unprompted | session 1, after the First Morning |
| **Accumulation** | the first rent collected; the first full store after a night away | beat 7.1; the second visit |
| **Collection** | the first card pack, and the album page it opens | clearing the Orcs ([`features/22-progression.md`](features/22-progression.md) §7) |
| **Power** | a hero that wins the room the party lost | the first fight lost, then won |
| **What is sold** | the Survey opening with levels already waiting, its paid column beside them | Townhall 2 ([`features/25-the-survey.md`](features/25-the-survey.md) §5) |

- The column and accumulation must land **in session 1**. Collection and
  power land in sessions 2–3 and are watched there.

## 2. During: what to watch

- **At each moment of §1**: a reaction or none; whether the player looks for
  more of it or skips past it.
- **The column's own signs:**
  - goes for a chest before Isolde asks, after the first one;
  - pans towards a silhouette, or taps it;
  - pays for fog no quest asked for;
  - chooses a direction to explore and can say why.
- **Where they get bored**, and what they were looking at when they did.
- **What they say aloud.** Note the words, not a summary of them.
- The observer never explains, hints or answers during the session.

## 3. After: five questions

Asked open, in this order, without suggesting the answer. The script is said
in the tester's language; the Spanish is the one used in the studio.

| Question | Script (ES) | What we look for | Alarm |
|---|---|---|---|
| Describe in one sentence what you were doing. | *Describe en una frase qué estabas haciendo.* | the fantasy's language: *finding what the fog took from my kingdom* | the mechanic or the interface: *tapping cells, opening menus* |
| What did you want to get next? | *¿Qué querías conseguir a continuación?* | a goal inside the fantasy: the chest beside the frontier, the shape in the clouds, the next level of the Survey | *I don't know*, or an interface goal (*finish the quest*) |
| Which moment did you like best? | *¿Qué momento te gustó más?* | one of §1's moments | one nobody designed: name it, and weigh reinforcing it |
| What would you have liked to have, or get faster? | *¿Qué te habría gustado tener ya o conseguir más rápido?* | something that expresses the fantasy: more of the map, the next find | only *less waiting*: then what is sold is relief |
| Would you come back tomorrow? What for? | *¿Volverías mañana? ¿Para qué?* | a reason tied to a layer: the full stores, the next chest, the shape in the clouds | a generic reason, or none |

- **The first answer is the test.** Record it verbatim before asking the
  rest.

## 4. With real players: reading the numbers

The numbers give leads, not verdicts.

| Reading | Lead | Where to look first |
|---|---|---|
| A good first reaction and a low D1 | the column does not renew from one day to the next | the treasure cadence and the fog's price (**OQ-120**) |
| Short, infrequent sessions | a layer that gives a reason to come back is missing | the stores and the Mana well filling overnight |
| Good retention, low conversion | what is sold does not express the fantasy | the Survey's paid column (**OQ-121**), the keys, the packs |

- **If the fantasy does not land, iterate the framing, the feedback and the
  first session before adding a feature.**
- Every reading keeps the store's caveat: **an intent is not a conversion**
  ([`features/14-monetization.md`](features/14-monetization.md) §0).

## 5. Signals the log carries

Beside the store's funnel ([`features/14-monetization.md`](features/14-monetization.md)
§4), for §2's signs to be read without an observer. The save carries them:
counts under `signal:*` on the tallies, times in `kingdom.signals`.

| Signal | Read as |
|---|---|
| a chest discovered → picked up, and the time between | does the find pull the player |
| a silhouette sighted → its cell discovered, and the time between | does the mystery pull the player |
| a paid reveal no active quest asked for | exploring for its own sake |
| the Survey opened · a cell claimed · its paid column bought | does the column sell |
| the session's first tap after an absence of five minutes or more: a store, a reveal or a menu | what brought the player back |

## 6. Deliberately not in this protocol

- **Asking the tester to name the fantasy**, or offering a list to choose
  from: the sentence has to be theirs.
- **Explaining with neuroscience** why a moment should hook: it is checked by
  playing.
- **Designing a version for one gender**: the framing is adjusted, the game
  is not split.
- Scores or a questionnaire on a scale: the five questions are open on
  purpose.
