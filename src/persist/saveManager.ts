// Orchestration: localStorage first (synchronous, survives offline), then a
// debounced upsert to Supabase. On boot, the newer of local vs cloud wins.

import { serialize, type SaveFile } from '../sim/save';
import type { GameState } from '../sim/state';
import { cloudClear, cloudInit, cloudLoad, cloudSave } from './cloud';
import { clearLocal, lastResetAt, loadLocal, markReset, saveLocal } from './local';

const CLOUD_DEBOUNCE_MS = 3000;

export class SaveManager {
  cloudActive = false;
  /** Set by reset(): every later save() is a no-op so the pagehide/autosave
   *  hooks can't resurrect the save while the page reloads. */
  private disabled = false;
  private cloudTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingCloud: SaveFile | null = null;

  async init(): Promise<void> {
    this.cloudActive = await cloudInit();
  }

  /**
   * Newer-of(local, cloud) by LastSaved — minus anything a reset already
   * killed.
   *
   * `cloudClear()` is best-effort and swallows its failures, and the cloud
   * wins a tie-break against a local save that no longer exists. So a reset
   * that could not reach the network used to LOOK like it worked and then
   * silently restore the old kingdom on the reload — the one bug a reset
   * button must not have, because the player's next move is to report that
   * the game starts with things in it.
   *
   * The reset stamps the device. A cloud save older than that stamp is the
   * one the player asked to destroy, whatever the network said at the time.
   * A save from ANOTHER device, written after the reset, still loads.
   */
  async load(): Promise<SaveFile | null> {
    const local = loadLocal();
    const resetAt = lastResetAt();
    const fromCloud = this.cloudActive ? await cloudLoad() : null;
    const cloud = fromCloud !== null && Date.parse(fromCloud.LastSaved) < resetAt
      ? null
      : fromCloud;
    if (local && cloud) {
      return Date.parse(cloud.LastSaved) > Date.parse(local.LastSaved) ? cloud : local;
    }
    return cloud ?? local;
  }

  /** Wipe local + cloud saves and disarm all future saves. Caller reloads. */
  async reset(): Promise<void> {
    this.disabled = true;
    if (this.cloudTimer !== null) {
      clearTimeout(this.cloudTimer);
      this.cloudTimer = null;
    }
    this.pendingCloud = null;
    clearLocal();
    // Stamped BEFORE the network call, so a clear that never lands is still
    // refused by the loader.
    markReset(Date.now());
    if (this.cloudActive) await cloudClear();
  }

  save(state: GameState, now: number, flush = false): void {
    if (this.disabled) return;
    const file = serialize(state, now);
    saveLocal(file);
    if (!this.cloudActive) return;
    this.pendingCloud = file;
    if (flush) {
      void this.flushCloud();
      return;
    }
    if (this.cloudTimer === null) {
      this.cloudTimer = setTimeout(() => void this.flushCloud(), CLOUD_DEBOUNCE_MS);
    }
  }

  private async flushCloud(): Promise<void> {
    if (this.cloudTimer !== null) {
      clearTimeout(this.cloudTimer);
      this.cloudTimer = null;
    }
    const file = this.pendingCloud;
    this.pendingCloud = null;
    if (file) await cloudSave(file);
  }
}
