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
      email = data.session.user.email || null;
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

// THE ACCOUNT (Docs/features/15-social.md §2): a kingdom starts on an
// anonymous user; linking an email to it lets the same kingdom be played
// on another device, by a six-digit code sent to that email.

/** Why an email step was refused, in the player's words. */
export type AccountProblem = 'taken' | 'unknown' | 'badCode' | 'tooMany' | 'offline';

let email: string | null = null;

/** The email this kingdom is linked to; null while it is anonymous. */
export const cloudEmail = (): string | null => email;

function problemOf(error: { code?: string; message?: string; status?: number } | null): AccountProblem | null {
  if (error === null) return null;
  const code = error.code ?? '';
  if (code === 'email_exists' || code === 'user_already_exists' || /already been registered/i.test(error.message ?? '')) return 'taken';
  if (code === 'otp_expired' || code === 'invalid_otp' || /token has expired or is invalid/i.test(error.message ?? '')) return 'badCode';
  if (code === 'otp_disabled' || code === 'signup_disabled' || code === 'user_not_found' || /signups not allowed/i.test(error.message ?? '')) return 'unknown';
  if (code.startsWith('over_') || error.status === 429) return 'tooMany';
  return 'offline';
}

async function call(f: () => Promise<{ error: { code?: string; message?: string; status?: number } | null }>): Promise<AccountProblem | null> {
  if (!client) return 'offline';
  try {
    return problemOf((await f()).error);
  } catch {
    return 'offline';
  }
}

/** Link an email to this kingdom: a code goes to it. */
export const linkEmailStart = (to: string): Promise<AccountProblem | null> =>
  call(() => client!.auth.updateUser({ email: to }));

/** The code that came: the email is this kingdom's now. */
export async function linkEmailVerify(to: string, code: string): Promise<AccountProblem | null> {
  const problem = await call(() => client!.auth.verifyOtp({ email: to, token: code, type: 'email_change' }));
  if (problem === null) email = to;
  return problem;
}

/** Play the kingdom an email keeps, on this device: a code goes to it. */
export const signInStart = (to: string): Promise<AccountProblem | null> =>
  call(() => client!.auth.signInWithOtp({ email: to, options: { shouldCreateUser: false } }));

/** The code that came: this device is that kingdom's now. The caller drops
 *  this device's save and reloads, so the cloud's is the one that loads. */
export const signInVerify = (to: string, code: string): Promise<AccountProblem | null> =>
  call(() => client!.auth.verifyOtp({ email: to, token: code, type: 'email' }));

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
