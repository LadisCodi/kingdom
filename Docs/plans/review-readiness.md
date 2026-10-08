# Plan — ready for the prototype review

> **What this is.** What is left before Kingdom is presented against the
> studio's prototype checklist ("GD – Primer análisis"): the answers the
> checklist asks for that the docs do not give yet, and the work the
> [`../implementation-plan.md`](../implementation-plan.md) still lists as not
> built. The UX fixes are [`ux-pass.md`](ux-pass.md).
>
> **Status: planned.**

## 1. Decisions — design, before code

Each is answered by editing the doc named, then striking the row in
[`../open-questions.md`](../open-questions.md) where it has an id.

| # | Decision | Answer goes in | Checklist item |
|---|---|---|---|
| D1 | **What production builds to reach the store**, and what stays in the prototype: engine, real purchases for the simulated store, accounts, odds disclosure, the dev tools and the payer profile out | a new `Docs/mvp-scope.md` | 15, 16 |
| D2 | **Go / iterate / drop thresholds** for the playtest: the share of testers whose first answer is in the fantasy's words, the chest → pickup time, the share of paid reveals no quest asked for, D1 | [`../playtest.md`](../playtest.md) §4 | 20 |
| D3 | **How long a season on the world board lasts** (**OQ-3**) — urgent now the board is online | [`../features/19-world-map.md`](../features/19-world-map.md) | 17 |
| D4 | **Do we tell testers we measure intent** (**OQ-29**) — before a tester sees a price | [`../features/14-monetization.md`](../features/14-monetization.md) | 15 |
| D5 | **How many systems the game carries** (**OQ-6**) | [`../overview.md`](../overview.md) | 17 |
| D6 | **The First Morning's length** (**OQ-117**) — set by the first playtest | [`../features/23-tutorials.md`](../features/23-tutorials.md) | 7 |

## 2. Build — one branch each, into `develop`

| # | Step | Plan or doc | Blocked on |
|---|---|---|---|
| B1 | **Playtester analytics** — the table, the sender, the events, the views | [`analytics.md`](analytics.md) | D4 |
| B2 | **The balance tool** — the 30-day harness does not match play. Either its policy plays like a person (taps, collects, fights lairs, reveals by quest and by sight), or its pacing assertions go and the balance pass is read from B1 | `tests/thirtyDays.test.ts`, [`../implementation-plan.md`](../implementation-plan.md) § *The balance pass* | — |
| B3 | **The social layer** — accounts, neighbours and help, guilds, the guild week | [`online-server.md`](online-server.md) steps 4–7, [`../features/15-social.md`](../features/15-social.md) | OQ-33, OQ-34, OQ-36, OQ-38, OQ-39 |
| B4 | **The event archetype** — and an event in the catalogue; closes H3 | [`../features/13-events.md`](../features/13-events.md) | OQ-18, OQ-19 |
| B5 | **Heroes onto the resolver** — closes OQ-95 | [`../features/10-heroes.md`](../features/10-heroes.md) §2 | — |
| B6 | **The Dragon's Nest** | [`../proposals/builder-30-days.md`](../proposals/builder-30-days.md) §3 | — |
| B7 | **Dungeons** — supplies, the Scout preview, boss chests (**OQ-122**) | [`../features/11-expeditions.md`](../features/11-expeditions.md) | OQ-122 |
| B8 | **Combat** — troop evolutions II–V, authored boss formations (**OQ-86**) | [`../features/combat.md`](../features/combat.md) | OQ-86 |
| B9 | **New sounds** (H7) | [`../audio-wishlist.md`](../audio-wishlist.md) | — |

- Order for the review: **B1 and B2 first** — without them the playtest
  cannot be read. B3–B9 only if the review asks for them.

## 3. Docs hygiene — one `feature/docs-*` branch

- [`../implementation-plan.md`](../implementation-plan.md): the world board
  runs on the real server (step 3 of [`online-server.md`](online-server.md)),
  not a local stand-in — §2 row 19 and §5.
- The contradictions of [`../open-questions.md`](../open-questions.md) § I:
  **OQ-123**, **OQ-124**, **OQ-125**, **OQ-126**, and the data nothing reads,
  **OQ-127**.
- [`../README.md`](../README.md): rows for this plan and
  [`ux-pass.md`](ux-pass.md) in the plans table.

## 4. The checklist answers to bring

Once §1 and B1–B2 are done, the review sheet is filled from:

| Checklist block | From |
|---|---|
| 1 · Theme and fantasy | [`../overview.md`](../overview.md) § *The fantasies* |
| 2 · Loop and decisions | [`../overview.md`](../overview.md) § *The core loop* |
| 3 · Progression and return | [`../overview.md`](../overview.md) § *Progression*, [`../playtest.md`](../playtest.md) §1 |
| 4 · Appeal | [`../overview.md`](../overview.md) § *The pitch* |
| 5 · MVP readiness | D1, D3, D5 |
| 6 · What to learn | [`../overview.md`](../overview.md) § *What the prototype is for*, D2 |

## 5. Deliberately not in this plan

- Cutting systems from the prototype: it is built.
- Wonders — unsequenced in [`../implementation-plan.md`](../implementation-plan.md).
- The real-money store itself: that is production's, after D1.
