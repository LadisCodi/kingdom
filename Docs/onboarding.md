Onboarding
---

Tutorials, quests and systems should be built and balance to provide the following experience:

1. Discover cells = Obtain knowledge
2. Trees are discovered around the Townhall, but Forestry is required.
3. Investigate Forestry (first tech, fast, 3 second), this allows chopping trees with the tap.
4. Build first house.
5. Collect food from berries.
6. Train first citizen.
7. Explore more cells.
8. Get Food from wild animals.
9. Research agriculture = Unlock farmlands + farm.
10. Harvest food from farmlands by tapping. Automating this becamos the objective.
11. Get wood from manually tapping trees, enough to build a Farm besides a Farmland.
12. Assign the worker to the Farm to start working on the farm land.
13. Train another citizen (one house should be able to provide +2 capacity)
14. Build a second house. Wood price starts to be painful here. Automating the wood recollecting looks like a good idea.
15. Research Saws = Unlock building the Sawmill.
16. Build a Sawmill
17. Assign two workers on the Sawmill, wood recollection is now automated.
18. Explore more cells.
19. Claim one shrine (the one near the townhall is the best candidate)
20. Upgrade exploration speed by purchasing upgrades in the tech tree that make each tap on a undiscovered cell count as x2, then x3.
21. Research the tech to be able to explore mountains.
22. Research the tech to be able to explore water.
23. Find the first combat focused dungeon.
24. Now that there's combat in sight, focus on quests towards building the barracks and train your first units.
25. Guide the player towards launching their first spin in the heroes banner (free the first time).
26. Quest for completing the first depth of the dungeon.

TODO: Once we have the previous experiencie we will keep adding here, but that should be enough for now
---

## What this became (built 2026-09-02)

The 26 steps above are the design intent and stay as written. This section
records how each became a mechanic, and the four decisions taken to get there.

### Four decisions

1. **The opening purse.** Step 1 is "discover cells", but revealing costs Gold
   and a new game started with **none** — and with trees gated behind Forestry,
   Forestry behind Knowledge, and Knowledge behind revealing, the opening had
   no entry point at all. A new kingdom now starts with **25 Gold**: enough for
   five frontier cells (3-5 Gold each) paying 10+ Knowledge against Forestry's
   8. `tests/quests.test.ts` asserts that sum at the *worst* frontier the
   player can pick, so it fails if anyone retunes the fog curve, the grant, the
   reveal yield or Forestry's price in isolation.
2. **The shrine at step 19.** It had been priced at 5,000 Gold as a deliberate
   long save; at step 19 the player has two Houses and a Sawmill. Re-priced to
   **400 Gold**. The other tiers stay at 25,000 and 100,000, so the "save up
   for it" beat moves to the second shrine.
3. **The free first summon (step 25).** A pull costs 30 Gems and a new game
   grants 10. The first call on the standard banner is now **free**, tracked on
   the pull counter that already persists for pity — no new save field. The
   button reads "Call — free" rather than rendering a price of zero.
4. **Cut content.** The Market, Quarry, Mine and Townhall 3 are absent from the
   26 steps; they moved to quests 32+. **Townhall 2 was woven in** at quest 17,
   because Townhall 1 caps the city at 2 Houses and 1 Sawmill and step 17
   reaches that cap.

### Step by step

| Steps | Quests | What was built |
|---|---|---|
| 1 | `FirstSteps` | The game opens on the **fog**, not a tap. Five cells → 10 Knowledge. |
| 2-3 | `Woodcraft`, `Timber` | `HarvestSpec.requiredTech` is new: the Forest is gated on **Forestry**, which is now a **3-second** research and no longer unlocks the Sawmill. The trees are visible and refusing from the first second — that is what makes the first research something the player wants. A refused tap costs no Mana and says *"Research Forestry before you can work this"*. |
| 4-6 | `ARoof`, `Rations`, `FirstVillager` | Unchanged mechanics. The crop plot repricing (below) is what makes the Wood add up. |
| 7 | `TaxDay` | Added back into the chain: rent is what pays for more fog, and step 7 asks for more fog. |
| 8 | `WildGame` | Wild animals at (2,-2), inside the opening discover radius. Meat counts as 3 Food. |
| 9-12 | `Fields` … `ToWork` | **Agriculture now unlocks the Farm as well as FarmLands** — one research, so nothing sits between tapping a plot and automating it. Farming inherited the Farm's level-2 gate; **Crop Rotation was retired**, since it then unlocked nothing. |
| 13-14 | `Neighbors`, `GrowingTown` | **A level-1 House holds 2** (was 1), so the second villager needs no second roof. |
| 15-17 | `SawTeeth`, `TheSawmill`, `Crewed` | New tech **Saws** (Forestry → Saws → Sawmill). Chopping by hand and automating it are two decisions, ten beats apart. |
| 18-19 | `FurtherAfield`, `OldStones` | The Thorned Shrine at 400 Gold. |
| 20 | `Mapmakers`, `Surveyors` | New tech **Cartography** and new upgrade **Surveying** (max 2): each level makes one tap on the fog do the work of one more. It does **not** make a cell cheaper — the Gold is unchanged. What it buys back is the player's *time*, which is what exploring actually spends once the far rings cost 320 and 640 Gold at one Gold a tap. |
| 21-22 | `Highlands`, `PutToSea` | Scaling Tools and Sailing already existed; they now hang off Cartography, so steps 20→22 are one branch. |
| 23-26 | `ArmedMen` … `IntoTheDark` | The Hollow Barrow is discovered at (-2,2) from the first second. The Barracks needs 20 Stone, which the rock outcrop at (4,-1) supplies by hand — the Quarry is not until quest 34. |

### Also changed

- **Townhall L1→L2 costs 60 Wood** (was 40 Wood + 20 Stone). The chain reaches
  Townhall 2 at quest 17 and the Quarry at quest 34, so the upgrade could not
  ask for Stone.
- **A crop plot costs 10 Wood** (was 20). At 20 it cost twice a House, which
  stranded the player at step 10 with nothing left after the roof.
- **The first chop asks for 25 Wood** (was 10) — enough for the roof at step 4
  *and* the plot at step 10.

### Not done

Steps 23-26 are wired as quests but only the first is playable end to end in a
test; the delve and the banner need a running army and a party. The chain past
quest 31 is the pre-existing long game, re-ordered but not re-tuned.
