# Feature: relics and ingredients — a set with a shape

> Replaces the Fragment half of the collection substrate with a **nine-piece
> ingredient set per relic**, and gives Mana a job on both maps.
> **Status: designed, unstarted.**
>
> Companion docs: [`heroes-and-gacha.md`](heroes-and-gacha.md) (the substrate
> this edits), [`magic.md`](magic.md) (Mana, actives, attunement),
> [`knowledge.md`](knowledge.md) → becoming `stardust.md`, see
> [`tomes-and-research.md`](tomes-and-research.md) §2,
> [`map-scopes.md`](map-scopes.md) §6 (why the world map is the 3★ source).

## 0. Why this replaces Fragments

Today a relic levels with Knowledge and raises its tier cap with **Fragments** —
a fungible per-collectible counter (`collection.fragmentsPerTierBase` 10,
growth 2). That is the standard gacha shape and it is **forgettable**: twenty
fragments of the Warden's Seal is a number going up.

**Nine named ingredients with rarities are a set, and a set has a shape.** You
can see which piece is missing, and a missing piece is a want. That is the whole
engine of a sticker album, and it is why trading works in that genre.

And it **removes a system rather than adding one**: ingredients become the tier
gate, so `collection.ts` no longer needs two axes and **Fragments can be
deleted**. That satisfies the discipline test in
[`../road-to-mvp.md`](../road-to-mvp.md) §8 decision 11 and continues the
direction of `currency-simplification.md`.

## 1. The model

- Every relic has a **passive**, active while attuned.
- Most relics also have an **active** — a magic action cast for Mana.
- Unlocking a relic, and each level after, needs **9 ingredients** filling a
  3×3 grid.
- Ingredients carry **1★ / 2★ / 3★ rarity within the same set**. This is the
  load-bearing detail: the last piece is always the rare one, so the set has a
  tension curve rather than a progress bar.
- **Duplicates accumulate** (the grid shows `+1`, `+2`), and spares are what
  there is to trade.
- Ingredients are **tradeable between players** — the social layer's first
  peer-to-peer economy.
- **Stardust** (the renamed dungeon currency) still buys the level itself once
  the set is complete. See §8 on why that needs a decision.

## 2. The rarity split — which source pays which star

This is the most important table in the document, and it exists to stop the
relic arc from being gated entirely behind the most expensive layer in the plan.

| Rarity | Source | Role |
|---|---|---|
| **1★** | province ruins, delve hauls, orders, the daily chest | plentiful — carries a relic to level 2–3 alone |
| **2★** | hard province content and **temporary event provinces** | uncommon — gives an event a reason to be played |
| **3★** | **the world map only**: contested ruins, siege spoils, guild chests | rare, and **the only tier that is really traded** |

Three things follow.

**The province keeps a real faucet into the long arc.** If ingredients came only
from the world map, the game's only week-scale progression would sit behind the
layer that needs a server, shards and PvP — post-MVP, the largest project in the
plan, and the one that might never ship. The prototype would have its deepest
system with no source at all. It would also recreate exactly the failure
[`map-scopes.md`](map-scopes.md) exists to prevent: the province becoming a place
where nothing that matters happens.

**The world map gets something unique**, which is the whole question it has to
answer: it is the only route to max-level relics, whose passives improve the
province economy. The loop closes.

**Trading gets a gradient.** Nobody trades 1★; everybody wants 3★. That is what
makes the social layer load-bearing instead of decorative — if every ingredient
were equally rare there would be no trade, only queueing.

**The cost, stated deliberately:** a player who refuses the social layer **caps
out** — level 3 of 5 and no further. That is what Forge of Empires and Elvenar
do (the ceiling rewards sit behind guild content) and it is acceptable because
the siege is co-op rather than PvP. But it is a decision, not a detail.

## 3. Mana on both maps

> **Mana is what magic costs, wherever you are.**

In the province it hurries production — a tap is a small spell. On the world map
it bends an expedition, reveals what a node holds, or shortens a siege.

That is a better definition than the one in the docs today. "Mana is a tap
budget" is mechanically clean and **thematically empty**, and it is exactly the
complaint `00-design-intent.md` records about the game after magic was cut:
*"reads like a generic village simulator (charming)"*. Making Mana the magic
budget across both scopes, with relics as the spells, puts the wizard-monarch
back at the centre.

**What Mana does not pay for**, so the two scopes do not compete for one budget:

| Action | Costs |
|---|---|
| Tap a province cell | **1 Mana** |
| Cast a relic active, either map | **Mana** (`activeCost`) |
| Reveal a world node | **Gold + time**, scaling with distance |
| Send a party, claim, besiege | supplies, army commitment, time |

The verb split in [`map-scopes.md`](map-scopes.md) §4 is what keeps this honest:
the province is tapped, the world map is sent to. Mana rides the *magic* verb,
which appears in both.

## 4. Actives as effects on other players — already built

The ask was for relics that "interact with other systems, even other players".
No new architecture is needed: **a relic active aimed at a shared node or at a
guild siege is a modifier with an expiry, delivered as a `pending_effect`** —
the exact mechanism [`social-layer.md`](social-layer.md) §3.1 designs for daily
help, drained at load before the offline advance so the replay assertion holds.

Three examples from the catalogue that already exists:

- **Reveal the threat on a contested node** before committing units — the
  Scout's trait, pointed at the world.
- **Speed every guildmate's committed units** in a siege — *Haste* with a guild
  scope.
- **Shield your claim for 12 hours** — defence without anybody losing property,
  so it sits inside promise 1.

Casting reuses placement mode (`placementInfo()`, `markers()`, the priority-300
tap handler), so a world-map cast is the same code pointed at another scope.

## 5. Attune-or-arm becomes three-way, and gets stronger

Today exclusivity is binary: attuned to the kingdom **or** carried by a hero into
a delve. If the world map is *away*, the rule becomes three states — home,
underground, or abroad — and the question *"which do I need right now?"* gets
more interesting rather than muddier. The 5-minute swap lock
(`attunement.swapLockSeconds` 300) keeps the same job: reconfiguring is a
decision, not a reflex.

## 6. The content bill, and the shape I would author

Nine unique ingredients × 10 relics is **90 pieces of art**, and 180 if relics
reach twenty. Monopoly Go can afford that because the album *is* the game; here
it is a subsystem. Unique-per-relic also **makes trading worse**: if nothing
overlaps, your spares only help someone chasing the same relic.

> **1★ and 2★ slots draw from a shared pool of ~20 common ingredients. The 3★
> slots are unique and named per relic.**

Art cost ~20 shared plus 10–20 uniques instead of 90, more overlap to trade on,
and the "nine seals of the Warden" fantasy survives where it matters — on the
piece that is actually missing.

## 7. Trading, and the part that will break

The hard problem is not the ingredients, it is the abuse. Monopoly Go limits
trading with windows, trade caps and untradeable stickers precisely because open
trading collapses into alt-account farming and real-money trading.

For a prototype with named playtesters that is survivable, but the design has to
be born with:

- a **cap** on trades per window,
- a **window** rather than an always-open market,
- and **3★ either untradeable or one per event**.

Without those, the 3★ scarcity designed in §2 evaporates in a week, and with it
the reason to go to the world map at all.

## 8. What this deletes, and what it strands

**Deleted: Fragments.** `collection.fragmentsPerTierBase` / `Growth`,
`gacha.duplicateFragments` (20), `gacha.fragmentsPerMiss` (3),
`delve.fragmentsPerDepth` (1) and the per-collectible counter in
`kingdom.heroes.fragments`. Gacha duplicates convert to **ingredients** instead —
which is strictly better, because a duplicate that pays a named piece you can
see missing beats one that pays a number.

**Stranded: Stardust's role.** With ingredients as the real gate, the level cost
(`collection.levelCostBase` 20, growth 1.6, ~3,612 to max one collectible)
becomes a formality you will always be able to afford. Two honest exits:

- **Stardust pays to attune and reconfigure** — a recurring job instead of a
  terminal one, which also gives the 5-minute swap lock an economic partner.
- Or accept it as a secondary gate and **cut its curve** so it stops pretending
  to be the binding constraint.

What should not happen is two gates where one never closes.

**Save:** removing Fragments and adding ingredient inventories is a reshape, so
it needs a **migrator**, not a version bump — see `engine-seams.md` §4. Existing
Fragment balances convert to ingredients of the matching relic at the rate they
were earned, the same rule the currency-simplification migrator followed.

## 9. The screens

From the mockups, and both are close to final.

**Relics menu.** An `Attuned` row of slots — filled slots show level, the
passive summary and, when locked, the remaining swap time (`4m 56s`); an `Empty`
slot; and a gem-priced `Unlock` for the next one
(`attunement.slotGemCostBase` 20, growth 2.5, `maxSlots` 5). Below, the `Relics`
grid: owned relics with level, passive chip, name and an **`n/9` progress bar** —
which is what lets a player see at a glance which relic is close — and unowned
relics as **silhouettes in black**, not question marks, so the set has a visible
shape from the first session.

**Relic details.** Name, level, icon, passive line, then the magic action as its
own panel with its Mana cost and a `Cast` button, then the 3×3 ingredient grid
with star rarity per slot and `+n` on duplicates, then `Upgrade` with its
Stardust cost.

One note: the silhouette treatment matters more than it looks. A `?` says
"something exists"; a black shape says "*that* is what you are missing", which
is the whole reason a set outperforms a counter.

## Open decisions

1. **Are 3★ ingredients world-map-only?** (`../road-to-mvp.md` §8.) It ties the
   long arc to the most expensive layer in the plan. Recommendation: yes, but
   only once the world map exists — until then 3★ drop from the co-op siege,
   which is the world map's first node.
2. **Shared pool or unique per relic?** §6 recommends the hybrid.
3. **What Stardust is for afterwards.** §8.
4. **Trading rules**, and whether trading exists in the prototype at all. It is
   the most socially interesting mechanic here and the one most likely to be
   abused by the very playtesters we need honest data from.
5. **Do ingredients drop for relics you do not own yet?** They must, or an
   unowned relic can never start. That means the album shows progress on
   silhouettes, which is also the strongest pull the screen has.
