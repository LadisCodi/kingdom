// Seeded, replay-safe randomness (Docs/implementation-plan.md §1).
//
// A counter/HASH, not a stateful stream, and the reason is structural rather
// than stylistic:
//
//  1. A stream makes a draw depend on how many draws came before it, and this
//     sim does not guarantee that count is the same in both paths — `advance`
//     deliberately groups its work differently in one-call replay than in
//     stepped ticking. Any consumer whose NUMBER of queries varies with the
//     grouping would silently desync the two, and the failure would surface as
//     a state divergence thousands of draws downstream from its cause. A hash
//     makes the value a pure function of the IDENTITY of the event, so the
//     grouping is irrelevant by construction.
//  2. Content drift. Adding a random consumer mid-season shifts every
//     subsequent draw for every existing player under a stream. Under a hash a
//     new consumer occupies a new key namespace and disturbs nothing.
//  3. Save/load is one integer — no cursor to keep consistent with a partially
//     replayed window, and no question about what the 8h cap's time-shift does
//     to it.
//  4. It is already the proven pattern here: feature respawn placement used
//     exactly this shape, which is why tests/respawn.test.ts is green.
//
// The one case a stream would win — a long unkeyed sequence like a gacha pity
// deck — is a non-problem: the pull counter IS the key, and it has to be
// persisted for pity anyway.
//
// All arithmetic is integer (Math.imul, >>> 0), so results are bit-identical
// across JS engines. The sim is meant to be portable to a server, and gacha
// odds are the one thing that will eventually have to be server-authoritative.

/** Non-printable, and never produced by a coordKey or an entity id, so
 *  ('ab','c') and ('a','bc') cannot collide. */
const SEPARATOR = '\u001f';

/** FNV-1a-flavoured mixing with a final avalanche, all in 32-bit space. */
function hash32(text: string, seed: number): number {
  let h = (seed ^ 0x811c9dc5) >>> 0;
  for (let i = 0; i < text.length; i++) {
    h = (h ^ text.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // Avalanche, so neighbouring keys ('...:1', '...:2') do not land nearby.
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export type RngPart = string | number;

/**
 * A uniform value in [0, 1).
 *
 * `parts` must identify the EVENT — a ruin id and a depth, an origin cell and
 * a respawn generation, a banner and a pull number — never the moment it was
 * queried. Two calls with the same parts must mean the same question.
 */
export const rand = (seed: number, ...parts: RngPart[]): number =>
  hash32(parts.join(SEPARATOR), seed) / 0x1_0000_0000;

/** A uniform integer in [0, max). Returns 0 for max ≤ 0. */
export const randInt = (seed: number, max: number, ...parts: RngPart[]): number =>
  max <= 0 ? 0 : hash32(parts.join(SEPARATOR), seed) % max;

/** One of `items`, uniformly. Callers must have checked it is non-empty. */
export const pick = <T>(seed: number, items: readonly T[], ...parts: RngPart[]): T =>
  items[randInt(seed, items.length, ...parts)];

/** True with probability `p`. */
export const chance = (seed: number, p: number, ...parts: RngPart[]): boolean =>
  rand(seed, ...parts) < p;

/** A fresh world seed. The ONE place a new game reaches for real entropy —
 *  everything downstream is a pure function of it. */
export const newSeed = (): number => Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
