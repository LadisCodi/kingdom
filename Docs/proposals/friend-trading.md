# Proposal — trading with friends: the wish board

> **What this is.** The world map's Exchange (an anonymous market among the
> board's six, [`../features/19-world-map.md`](../features/19-world-map.md)
> §7.5) goes, and friends trade instead, on a **wish board**: a player pins
> what they need and what they give for it, and any friend who has it fills
> it in one tap. Modelled on Clash Royale's requests and Township's help,
> with the rules of Idle Town Master's *Comercio*. Mockups: M75 (the first
> pass, beside the two directions not taken, M74 and M76), M77, M78 (this
> design). **Built**: the live design is
> [`../features/15-social.md`](../features/15-social.md) §2.4.

## 1. What trades

- **The three precious materials** (Starmetal, Heartwood, Moonglass), in
  lots of **5**.
- **Relic fragments**, one at a time: a **piece** or a **keystone**
  (`relic-restoration.md` §2).
  - **Asked for only if missing**: a wish names a slot the player holds
    none of — never a spare to level a relic with.
  - **Given only if duplicated**: the giver must hold at least two in that
    slot, and keeps one. A single fragment can never be given.
  - Only **found** fragments leave, never bound ones (rule 8).
- **What pairs with what — one lot for one lot:**

  | Give ↓ / Get → | Material ×5 | Piece | Keystone |
  |---|---|---|---|
  | **Material ×5** | ✓ (another material) | ✓ | — |
  | **Piece** | ✓ | ✓ | — |
  | **Keystone** | — | — | ✓ |

  Never the same thing both ways.

## 2. The Trade tab

A third tab on the Friends menu: **List · Trade · Inbox**.

- **Your wishes n/3**, on top: each a card *I need* → *I give*, the time
  left, and a ✕ to withdraw it (its stake comes back). An empty dashed card
  *+ Make a wish* while fewer than three are pinned.
- **Friends need**, under it: every friend's open wishes, their crest and
  name on each.
  - The ones the player can fill first — a fragment they hold at least two
    of, or the material ×5 — lit, *You have it* and **Fill**.
  - The rest greyed, *You don't have it*.
  - Empty: *Your friends have no wishes just now*.
- **Fills left today** in the section head (*Fills 3/5*).
- **A red seal** on the Trade tab, and the Friends knob's orb, while a
  friend's wish can be filled.

## 3. Making a wish

Two windows, one after the other, from *+ Make a wish*:

1. **What do you need?** (step 1 of 2)
   - **One relic a row**, every relic met: its picture and name, then its
     six slots across the row — held ones faded, missing ones as dashed
     outlines; the keystone is the sixth, a size up, gold-rimmed.
   - A missing slot is picked; nothing else in a row is.
   - Under the relics, the three materials ×5.
   - A pick goes straight to step 2.
2. **What will you give?** (step 2 of 2)
   - The need on top, small, with a way back to step 1.
   - **Only what pairs with it** (§1), from the player's goods: duplicated
     fragments (×2 or more) and materials ×5.
   - A fragment held once is greyed, *Only 1*; a keystone for anything but
     a keystone is greyed, *Keystone only*.
   - *Held until a friend fills it, or for 48 hours.* **Pin wish**: the
     stake leaves the player's goods.

- Up to **3** wishes at once. A wish never asks for what the player already
  wishes for.

## 4. Filling a wish

- **Fill** → at once: the friend gets what they needed, from the player's
  goods; the player gets the friend's stake.
- *Wish filled!* — the friend's crest, *You gave*, *You got*.
- Both get an Inbox message: *You filled Foxhollow's wish* / *Oakville
  filled your wish*, with what moved.
- **5 fills a day** (resets at the player's midnight). Pinning and receiving
  are not capped.
- The filler gets nothing beyond the stake.

## 5. Ending

- **48 hours** with nobody filling it: the wish goes, its stake comes back,
  and the Inbox says so (*Your wish expired*).
- **Withdrawn**: the stake comes back at once.
- A friend removed: their wishes leave the board; your wishes stay.

## 6. Where it lives

- The social server holds the wishes and their stakes, and does every fill
  as one mutation: a wish is filled once, by one friend.
- The client sends what leaves its goods with the pin; a fill's goods come
  back the way server effects do (`15-social.md` §1.2), applied once,
  before the offline advance.

## 7. Dials, in the order to reach for them

| Dial | Where |
|---|---|
| Lot sizes | `?dev=data` › Friends (`trade.materialLot`, `pieceLot`, `keystoneLot`) |
| Wishes at once, fills a day | `trade.wishes`, `trade.fillsPerDay` |
| How long a wish stands | `trade.wishHours` |

## 8. Deliberately not in this design

- A direct offer to one friend (direction A, M74), or a negotiated crate
  (direction C, M76).
- Trading with players who are not friends; a market.
- Gifts; anything paid to the filler.
- Refined goods, currencies, items.
