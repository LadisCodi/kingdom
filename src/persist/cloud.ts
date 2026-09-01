// Supabase cloud saves: anonymous auth + one jsonb row per player. When the
// env vars are absent the game runs in local-save-only mode.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SaveFile } from '../sim/save';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;
let userId: string | null = null;

export const cloudConfigured = (): boolean => Boolean(url && anonKey);

/** Ensure a session (anonymous sign-in on first visit). Returns false if unavailable. */
export async function cloudInit(): Promise<boolean> {
  if (!cloudConfigured()) return false;
  try {
    client = createClient(url!, anonKey!);
    const { data } = await client.auth.getSession();
    if (data.session) {
      userId = data.session.user.id;
      return true;
    }
    const { data: anon, error } = await client.auth.signInAnonymously();
    if (error || !anon.user) return false;
    userId = anon.user.id;
    return true;
  } catch {
    return false;
  }
}

export async function cloudLoad(): Promise<SaveFile | null> {
  if (!client || !userId) return null;
  try {
    const { data } = await client.from('saves').select('data').eq('user_id', userId).maybeSingle();
    return (data?.data as SaveFile) ?? null;
  } catch {
    return null;
  }
}

/** Delete this player's save row (best effort — reset must not hang on it). */
export async function cloudClear(): Promise<void> {
  if (!client || !userId) return;
  try {
    await client.from('saves').delete().eq('user_id', userId);
  } catch {
    // Offline/unavailable: the local wipe still resets the game.
  }
}

export async function cloudSave(save: SaveFile): Promise<boolean> {
  if (!client || !userId) return false;
  try {
    const { error } = await client.from('saves').upsert({
      user_id: userId,
      data: save,
      game_version: save.GameVersion,
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}
