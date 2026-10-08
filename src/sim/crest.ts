// A KINGDOM'S CREST (Docs/features/15-social.md §2.2): a field in one of
// eight tinctures and one of twelve charges on it, chosen by the player.
// Written as `<tincture>.<charge>` wherever it travels — the save, the
// social server's profile, the world board's seat. A kingdom that never
// chose one wears the crest its nickname picks, the same on every screen
// and every device, since a nickname is unique and never changes.

import { randInt } from './rng';

/** The heraldic fields, in the order the editor offers them. */
export const TINCTURES = ['gules', 'azure', 'vert', 'purpure', 'sable', 'tenne', 'celeste', 'murrey'] as const;
export type Tincture = (typeof TINCTURES)[number];

/** The charges, in the order the editor offers them. */
export const CHARGES = [
  'lion', 'fleur', 'tree', 'crown', 'tower', 'star', 'eagle', 'key', 'swords', 'dragon', 'stag', 'ship',
] as const;
export type Charge = (typeof CHARGES)[number];

export interface Crest { tincture: Tincture; charge: Charge }

export const crestId = (c: Crest): string => `${c.tincture}.${c.charge}`;

/** A crest as written, or null if it is not one. */
export function parseCrest(raw: unknown): Crest | null {
  if (typeof raw !== 'string') return null;
  const [tincture, charge, ...rest] = raw.split('.');
  if (rest.length > 0) return null;
  if (!(TINCTURES as readonly string[]).includes(tincture) || !(CHARGES as readonly string[]).includes(charge)) return null;
  return { tincture: tincture as Tincture, charge: charge as Charge };
}

/** The crest a nickname wears until its kingdom chooses one. */
export function defaultCrest(nickname: string): Crest {
  const key = nickname.trim().toLowerCase();
  return {
    tincture: TINCTURES[randInt(0xc4e57, TINCTURES.length, 'tincture', key)],
    charge: CHARGES[randInt(0xc4e57, CHARGES.length, 'charge', key)],
  };
}

/** The crest a kingdom wears: the one it chose, else its nickname's. */
export const crestOf = (nickname: string, chosen: string | null | undefined): Crest =>
  parseCrest(chosen) ?? defaultCrest(nickname);
