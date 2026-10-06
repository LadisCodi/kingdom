// The `social` edge function: the friends list (Docs/features/15-social.md
// §2.1). Glue only — who the user is, the tables, the clock. The rules are
// `serveSocial`, bundled from src/socialServer/serve.ts into the same
// `_shared/world.js` the world function runs (`npm run server:bundle`).

import { createClient } from 'npm:@supabase/supabase-js@2';
// Plain JS, built: its types are src/socialServer/serve.ts's SocialStore.
import { serveSocial } from '../_shared/world.js';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const PROFILE = 'user_id, nickname, code, townhall, cells, crest, seen_at';

interface Row {
  user_id: string; nickname: string; code: string | null; townhall: number; cells: number; crest: string | null; seen_at: string | null;
}

const profileOf = (r: Row) => ({
  userId: r.user_id, nickname: r.nickname, code: r.code, townhall: r.townhall, cells: r.cells, crest: r.crest,
  seenAt: r.seen_at === null ? null : Date.parse(r.seen_at),
});

const iso = (ms: number) => new Date(ms).toISOString();

const MESSAGE = 'user_id, id, kind, from_id, created_at, read_at, state, lots';

interface MessageRow {
  user_id: string; id: string; kind: string; from_id: string; created_at: string; read_at: string | null; state: string | null;
  lots: unknown;
}

/** A message as `serveSocial` reads it (src/socialServer/serve.ts MessageRow). */
interface Message {
  userId: string; id: string; kind: string; fromId: string; at: number; readAt: number | null; state: string | null;
  lots?: unknown;
}

const messageOf = (r: MessageRow): Message => ({
  userId: r.user_id, id: r.id, kind: r.kind, fromId: r.from_id, at: Date.parse(r.created_at),
  readAt: r.read_at === null ? null : Date.parse(r.read_at), state: r.state, lots: r.lots ?? null,
});

const WISH = 'id, user_id, need, give, created_at, state, filled_by, filled_at';

interface WishRow {
  id: string; user_id: string; need: unknown; give: unknown; created_at: string; state: string;
  filled_by: string | null; filled_at: string | null;
}

/** A wish as `serveSocial` reads it (src/socialServer/serve.ts WishRow). */
const wishOf = (r: WishRow) => ({
  id: r.id, userId: r.user_id, need: r.need, give: r.give, at: Date.parse(r.created_at), state: r.state,
  filledBy: r.filled_by, filledAt: r.filled_at === null ? null : Date.parse(r.filled_at),
});

function rows<T>({ data, error }: { data: T[] | null; error: unknown }): T[] {
  if (error) throw error;
  return data ?? [];
}

const store = {
  async profile(userId: string) {
    const { data, error } = await admin.from('profiles').select(PROFILE).eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data === null ? null : profileOf(data as Row);
  },
  async profilesOf(ids: string[]) {
    if (ids.length === 0) return [];
    return rows<Row>(await admin.from('profiles').select(PROFILE).in('user_id', ids)).map(profileOf);
  },
  async byCode(code: string) {
    const { data, error } = await admin.from('profiles').select(PROFILE).eq('code', code).maybeSingle();
    if (error) throw error;
    return data === null ? null : profileOf(data as Row);
  },
  async byNickname(nickname: string) {
    const exact = nickname.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data, error } = await admin.from('profiles').select(PROFILE).ilike('nickname', exact).maybeSingle();
    if (error) throw error;
    return data === null ? null : profileOf(data as Row);
  },
  async claimNickname(userId: string, nickname: string) {
    const { data, error } = await admin.rpc('claim_nickname', { p_user: userId, p_nickname: nickname });
    if (error) throw error;
    return (data as string | null) ?? null;
  },
  async setCode(userId: string, code: string) {
    const { error } = await admin.from('profiles').update({ code }).eq('user_id', userId);
    if (error && (error as { code?: string }).code === '23505') return false;
    if (error) throw error;
    return true;
  },
  async touch(userId: string, progress: { townhall: number; cells: number; crest?: string | null; ack?: number }, now: number) {
    const { error } = await admin.from('profiles')
      .update({
        townhall: progress.townhall, cells: progress.cells, seen_at: iso(now),
        ...(progress.crest === undefined ? {} : { crest: progress.crest }),
      }).eq('user_id', userId);
    if (error) throw error;
  },
  async links(userId: string) {
    const [friends, incoming, outgoing] = await Promise.all([
      admin.from('friendships').select('friend_id').eq('user_id', userId),
      admin.from('friend_requests').select('from_id, created_at').eq('to_id', userId),
      admin.from('friend_requests').select('to_id, created_at').eq('from_id', userId),
    ]);
    return {
      friends: rows<{ friend_id: string }>(friends).map((r) => r.friend_id),
      incoming: rows<{ from_id: string; created_at: string }>(incoming).map((r) => ({ id: r.from_id, at: Date.parse(r.created_at) })),
      outgoing: rows<{ to_id: string; created_at: string }>(outgoing).map((r) => ({ id: r.to_id, at: Date.parse(r.created_at) })),
    };
  },
  async addRequest(from: string, to: string, now: number) {
    const { error } = await admin.from('friend_requests')
      .upsert({ from_id: from, to_id: to, created_at: iso(now) }, { onConflict: 'from_id,to_id', ignoreDuplicates: true });
    if (error) throw error;
  },
  async dropRequest(from: string, to: string) {
    const { error } = await admin.from('friend_requests').delete().eq('from_id', from).eq('to_id', to);
    if (error) throw error;
  },
  async befriend(a: string, b: string, max: number, now: number) {
    const { data, error } = await admin.rpc('befriend', { p_a: a, p_b: b, p_max: max, p_at: iso(now) });
    if (error) throw error;
    return data as 'ok' | 'full' | 'theirFull';
  },
  async unfriend(a: string, b: string) {
    const one = await admin.from('friendships').delete().eq('user_id', a).eq('friend_id', b);
    if (one.error) throw one.error;
    const two = await admin.from('friendships').delete().eq('user_id', b).eq('friend_id', a);
    if (two.error) throw two.error;
  },
  async recentlySeen(since: number, limit: number) {
    return rows<Row>(await admin.from('profiles').select(PROFILE).gte('seen_at', iso(since))
      .order('seen_at', { ascending: false }).limit(limit)).map(profileOf);
  },
  async boardmates(userId: string) {
    const { data, error } = await admin.from('seats').select('board_id').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    if (data === null) return [];
    return rows<{ user_id: string }>(await admin.from('seats').select('user_id').eq('board_id', data.board_id))
      .map((r) => r.user_id).filter((id) => id !== userId);
  },
  async messagesOf(userId: string) {
    return rows<MessageRow>(await admin.from('messages').select(MESSAGE).eq('user_id', userId)).map(messageOf);
  },
  async putMessage(m: Message) {
    const { error } = await admin.from('messages').upsert({
      user_id: m.userId, id: m.id, kind: m.kind, from_id: m.fromId, created_at: iso(m.at),
      read_at: m.readAt === null ? null : iso(m.readAt), state: m.state, lots: m.lots ?? null,
    }, { onConflict: 'user_id,id' });
    if (error) throw error;
  },
  async patchMessage(userId: string, id: string, patch: { readAt?: number; state?: string }) {
    const { error } = await admin.from('messages').update({
      ...(patch.readAt === undefined ? {} : { read_at: iso(patch.readAt) }),
      ...(patch.state === undefined ? {} : { state: patch.state }),
    }).eq('user_id', userId).eq('id', id);
    if (error) throw error;
  },
  async dropMessages(userId: string, ids: string[]) {
    if (ids.length === 0) return;
    const { error } = await admin.from('messages').delete().eq('user_id', userId).in('id', ids);
    if (error) throw error;
  },
  async openWishes(ids: string[]) {
    if (ids.length === 0) return [];
    return rows<WishRow>(await admin.from('wishes').select(WISH).eq('state', 'open').in('user_id', ids)).map(wishOf);
  },
  async addWish(w: { id: string; userId: string; need: unknown; give: unknown; at: number }) {
    const { error } = await admin.from('wishes')
      .insert({ id: w.id, user_id: w.userId, need: w.need, give: w.give, created_at: iso(w.at), state: 'open' });
    if (error) throw error;
  },
  /** One statement, conditional on the wish still being open: two fills at
   *  once cannot both take it. */
  async closeWish(id: string, end: { state: string; filledBy: string | null; filledAt: number | null }) {
    const { data, error } = await admin.from('wishes')
      .update({ state: end.state, filled_by: end.filledBy, filled_at: end.filledAt === null ? null : iso(end.filledAt) })
      .eq('id', id).eq('state', 'open').select(WISH);
    if (error) throw error;
    const hit = (data ?? []) as WishRow[];
    return hit.length === 0 ? null : wishOf(hit[0]);
  },
  async fillsSince(userId: string, since: number) {
    const { count, error } = await admin.from('wishes').select('id', { count: 'exact', head: true })
      .eq('filled_by', userId).gt('filled_at', iso(since));
    if (error) throw error;
    return count ?? 0;
  },
  async deliver(userId: string, lot: unknown, why: string) {
    const { error } = await admin.from('deliveries').insert({ user_id: userId, lot, why });
    if (error) throw error;
  },
  async deliveriesOf(userId: string) {
    return rows<{ seq: number; user_id: string; lot: unknown; why: string }>(
      await admin.from('deliveries').select('seq, user_id, lot, why').eq('user_id', userId).order('seq'),
    ).map((r) => ({ userId: r.user_id, seq: Number(r.seq), lot: r.lot, why: r.why }));
  },
  async dropDeliveries(userId: string, upTo: number) {
    const { error } = await admin.from('deliveries').delete().eq('user_id', userId).lte('seq', upTo);
    if (error) throw error;
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return json(401, { error: 'sign in first' });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'not JSON' });
  }
  try {
    const served = await serveSocial(store, auth.user.id, body, Date.now());
    return served.status === 200 ? json(200, served.reply) : json(served.status, { error: served.error });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'the social server failed' });
  }
});
