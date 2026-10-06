// Supabase cloud saves: anonymous auth + one jsonb row per player. When the
// env vars are absent the game runs in local-save-only mode.

import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError, createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { WorldCall } from '../worldServer/remote';
import type { SocialCall } from '../socialServer/remote';
import type { AnalyticsSend } from '../analytics/analytics';
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

/** The signed-in user's id, once `cloudInit` has a session. */
export const cloudUserId = (): string | null => userId;

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

/** One request to the `world` edge function (worldServer/remote.ts). A
 *  network failure, a relay failure, a server error or a board written
 *  under the request is worth another try; anything else is not. */
export const cloudWorldCall: WorldCall = (body) => invokeFunction('world', body);

/** One request to the `social` edge function (socialServer/remote.ts), on
 *  the same terms as the world's. */
export const cloudSocialCall: SocialCall = (body) => invokeFunction('social', body);

async function invokeFunction(
  name: string, body: object,
): Promise<{ ok: true; data: unknown } | { ok: false; retry: boolean; error: string }> {
  if (!client || !userId) return { ok: false, retry: false, error: 'no session' };
  try {
    const { data, error } = await client.functions.invoke(name, { body });
    if (!error) return { ok: true, data };
    if (error instanceof FunctionsHttpError) {
      const status = (error.context as Response).status;
      return { ok: false, retry: status >= 500 || status === 409, error: `HTTP ${status}` };
    }
    const retry = error instanceof FunctionsFetchError || error instanceof FunctionsRelayError;
    return { ok: false, retry, error: String(error.message ?? error) };
  } catch (err) {
    return { ok: false, retry: true, error: String(err) };
  }
}

/** A batch of analytics events into `analytics_events`
 *  (Docs/plans/analytics.md §5). A row already there is skipped, so a batch
 *  sent again counts once. */
export const cloudAnalyticsSend: AnalyticsSend = async (rows) => {
  if (!client || !userId) return false;
  try {
    const { error } = await client.from('analytics_events').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    return !error;
  } catch {
    return false;
  }
};
