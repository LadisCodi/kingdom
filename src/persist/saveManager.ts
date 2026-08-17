// Orchestration: localStorage first (synchronous, survives offline), then a
// debounced upsert to Supabase. On boot, the newer of local vs cloud wins.

import { serialize, type SaveFile } from '../sim/save';
import type { GameState } from '../sim/state';
import { cloudInit, cloudLoad, cloudSave } from './cloud';
import { loadLocal, saveLocal } from './local';

const CLOUD_DEBOUNCE_MS = 3000;

export class SaveManager {
  cloudActive = false;
  private cloudTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingCloud: SaveFile | null = null;

  async init(): Promise<void> {
    this.cloudActive = await cloudInit();
  }

  /** Newer-of(local, cloud) by LastSaved. */
  async load(): Promise<SaveFile | null> {
    const local = loadLocal();
    const cloud = this.cloudActive ? await cloudLoad() : null;
    if (local && cloud) {
      return Date.parse(cloud.LastSaved) > Date.parse(local.LastSaved) ? cloud : local;
    }
    return cloud ?? local;
  }

  save(state: GameState, now: number, flush = false): void {
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
