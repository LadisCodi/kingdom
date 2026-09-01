import type { SaveFile } from '../sim/save';

const KEY = 'kingdom.save';

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
