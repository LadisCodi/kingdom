# Knowledge: what exploring is for

**Built 2026-09-02.**

Knowledge existed from the first commit and did nothing. It had a currency
row, an icon, a purse line and a drip from ruins — and `11-gaps` recorded the
truth: *"Knowledge has no source or sink."* Artifact levelling spent it, but
that is a late screen most players never reach, so for the whole early game it
was a number that only went up.

It is now the currency that buys the technology tree, and it is earned by
going outside.

---

## 1. The rule

- **Technologies cost Knowledge and nothing else.** No Gold, no Wood, no
  Stone. The tree no longer asks "have you stockpiled?" — it asks **"have you
  been out there?"**
- **Instant upgrades stay Gold-only.** They are the city economy's own sink,
  bought out of the city's own purse, and they are what the player spends on
  between expeditions outward.
- Knowledge is **kingdom-scoped**. It lives in `state.kingdom.wallet`, not the
  city's, so `startTech` cannot be written the way `enqueueBuild` is — it pays
  from a different purse, and `techCost(id)` is the one accessor that reads
  the price.

That split is the point. Two currencies, two questions, two different things
to do with an afternoon:

| | pays for | earned by | purse |
|---|---|---|---|
| **Gold** | buildings, upgrades, clearing fog | the city working | city |
| **Knowledge** | the technology tree | exploring and quests | kingdom |

## 2. Where it comes from

**Clearing a cell of fog pays Knowledge equal to its ring** — distance 3 pays
3, distance 10 pays 10 (`knowledge.per_reveal_ring`, ×1). Only on the tap that
*finishes* the cell; partial payments bank nothing. This is the game's opening
move, not a side income: the first five cells are what buy Forestry.

Linear, against a reveal cost that doubles from ring 4 (1, 3, 5, 10, 20, 40,
80, 160, 320, 640 Gold). That gap is deliberate and it is the whole shape of
the economy:

- the far map is **worth going to** — ring 10 pays ten times ring 1;
- but no single cell is a **jackpot** — you cannot buy the tree by finding one
  lucky tile, only by pushing the border outward;
- and because the Gold cost outruns the Knowledge yield, exploring stays a
  real trade against building rather than a strictly better use of income.

**Quests pay Knowledge too**, from `Explorer` — the quest that first makes the
player clear fog, and so the quest that teaches where Knowledge comes from —
onward. Roughly `gold_reward / 10`, ramping from 3 to 90 across the chain.

Ruins keep their existing drip (`knowledge.drip_per_ruin_per_hour`, 2/h each),
and delves keep paying it by depth. Both are now sources of a currency that
means something before the Reliquary opens.

## 3. Supply against demand

| | Knowledge |
|---|---|
| the whole technology tree (23 techs) | **673** |
| the quest chain (50 quests) | **575** |
| revealing the entire map (342 cells) | **2,902** |

Tech prices started as the old Gold prices ÷ 10: Forestry 8, Urban Planning 20,
Communities 45, Deep Mining 80. Saws (12) and Cartography (18) were authored
against that scale by the onboarding rewrite; Crop Rotation was retired.

Three properties, each asserted by a test rather than left to playtest:

1. **The chain covers most of the tree and deliberately not all of it**
   (591 of 643). A player who only follows quests still has to have been on
   the map to finish researching.
2. **The map holds more than four times the tree.** About a quarter of the map
   funds every technology there is; the rest is surplus that flows into
   artifact and hero levelling, which is where Knowledge was always going.
3. **The chain's first tech gate is reachable when it arrives.** Quest 2
   (`Woodcraft`) *demands* Forestry, and quest 1 is the only thing before it —
   and pays no Knowledge of its own. Every point comes from the fog quest 1
   makes the player clear, so the sum that has to work is (cells asked for) ×
   (the cheapest Knowledge any of them can pay) ≥ Forestry. Cheapest, because
   the player picks the cells. See [`../onboarding.md`](../onboarding.md).

## 4. What the player sees

- **The plank shows Knowledge** from the first cell cleared, and keeps showing
  it afterwards — gated on the DISCOVERY flag, not the balance, so it does not
  vanish the moment research spends it to zero. A currency the player spends
  and cannot see is the same bug as a price hidden outside its button.
- **The reveal floater says what the cell paid** (`+3 📜`) instead of
  "Revealed!". Fog is the main source of Knowledge and the only one the player
  controls minute to minute; if the floater stays silent about it, the tree
  looks like it funds itself.
- The first Knowledge triggers the standard **"new resource discovered"**
  banner, like every other currency.
- The research node's Start button carries its Knowledge price **inside the
  button**, red when short, per the cost rule (`ui-menus-redesign.md` §6.4).
  No screen needed changing for that — the button already read the cost as a
  wallet, and `effectiveWalletValue` already routed Knowledge to the kingdom.

## 5. Balance surface

| sheet | column | note |
|---|---|---|
| `Technologies` | `cost_knowledge` | replaces the five `cost_*` columns |
| `Quests` | `reward_knowledge` | beside `reward_gems`; kingdom-scoped, so not part of `reward` |
| `Settings` | `knowledge.per_reveal_ring` | Knowledge per ring of distance, ×1 |

The importer rejects a technology priced below 1, so the tree cannot silently
become free.

## 6. Not done

- **Other sources.** The user's brief said "we will add other sources later" —
  a library district, a scholar assignment, and delve depth beyond the current
  drip are the obvious candidates.
- **The Gold sink that left with the tree.** Removing tech costs took 6,425
  Gold of sink out of the city economy. Fog reveal and building costs still
  absorb it, and the fog curve got *more* important as a result, but nobody
  has measured whether Gold now runs long in the mid-game. That is the first
  thing to look at after a real session.
