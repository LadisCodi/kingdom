// What the other kingdoms on the world board call a player
// (Docs/features/15-social.md §2). Chosen once, the first time the player
// goes out onto the board, and unique across the game whatever its case.
// The sheet checks it as the player types; the server checks it again and
// is the one that knows whether it is taken.

export const NICKNAME_MIN = 3;
export const NICKNAME_MAX = 16;

/** A name as it is kept: its ends trimmed, every run of spaces one space. */
export const normalNickname = (raw: string): string => raw.trim().replace(/\s+/g, ' ');

/** Why a name cannot be used, as a line for the player; null when it can. */
export function nicknameProblem(raw: string): string | null {
  const name = normalNickname(raw);
  if (name.length < NICKNAME_MIN) return 'At least three characters';
  if (name.length > NICKNAME_MAX) return 'At most sixteen characters';
  if (!/^[\p{L}\p{N} _-]+$/u.test(name)) return 'Letters, numbers, spaces, _ and - only';
  if (!/[\p{L}\p{N}]/u.test(name)) return 'A letter or a number, at least';
  return null;
}
