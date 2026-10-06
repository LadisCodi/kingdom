import type { SaveFile } from '../sim/save';

const KEY = 'kingdom.save';
/** When this device last reset. Deliberately NOT cleared by `clearLocal()` —
 *  it is the record that the wipe happened, and it has to outlive the thing
 *  it wiped. */
const RESET_KEY = 'kingdom.resetAt';
/** Who this device plays as when there is no signed-in user. Not cleared by
 *  a reset either: a reset starts the kingdom again, not the player. */
const PLAYER_KEY = 'kingdom.playerId';

export function loadLocal(): SaveFile | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SaveFile) : null;
  } catch {
    return null;
  }
}

export function saveLocal(save: SaveFile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Storage full/blocked — cloud save (if configured) still applies.
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Blocked storage: nothing to clear anyway.
  }
}

/** Stamp a reset. Read by the loader to refuse a cloud save the reset was
 *  meant to kill (see `SaveManager.load`). */
export function markReset(at: number): void {
  try {
    localStorage.setItem(RESET_KEY, String(at));
  } catch {
    // Blocked storage: the local save is gone anyway, and a cloud save that
    // survives is the case this marker exists to catch — it just cannot be
    // caught here.
  }
}

/** When this device last reset, or 0. */
/** Forget the reset stamp: it was about another account's save. */
export function clearResetMark(): void {
  try {
    localStorage.removeItem(RESET_KEY);
  } catch {
    // Blocked storage: there is no stamp to forget.
  }
}

export function lastResetAt(): number {
  try {
    const raw = localStorage.getItem(RESET_KEY);
    const n = raw === null ? 0 : Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** This device's player id, made on first use. A private window that blocks
 *  storage plays as a new player each visit. */
export function localPlayerId(): string {
  try {
    const known = localStorage.getItem(PLAYER_KEY);
    if (known !== null && known !== '') return known;
    const made = `local-${crypto.randomUUID()}`;
    localStorage.setItem(PLAYER_KEY, made);
    return made;
  } catch {
    return `local-${crypto.randomUUID()}`;
  }
}
