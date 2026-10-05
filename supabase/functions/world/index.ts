// The `world` edge function: the world server (Docs/plans/online-server.md §3).
// Glue only — who the user is, the two tables, the clock. The rules and
// everything between a request and its answer are `serveWorld`, bundled from
// src/worldServer/serve.ts by `npm run server:bundle` before a deploy.

import { createClient } from 'npm:@supabase/supabase-js@2';
// Plain JS, built: its types are src/worldServer/serve.ts's BoardStore.
import { serveWorld } from '../_shared/world.js';

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

const store = {
  async boardOf(userId: string) {
    const { data, error } = await admin.from('seats').select('board_id').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data?.board_id ?? null;
  },
  async load(boardId: string) {
    const { data, error } = await admin.from('boards').select('doc, version').eq('id', boardId).maybeSingle();
    if (error) throw error;
    return data === null ? null : { doc: data.doc, version: data.version };
  },
  async update(boardId: string, doc: unknown, version: number) {
    const { data, error } = await admin.rpc('update_board', { p_id: boardId, p_doc: doc, p_version: version });
    if (error) throw error;
    return data === true;
  },
  async create(doc: unknown, userId: string, seat: number) {
    const { data, error } = await admin.rpc('create_board', { p_doc: doc, p_user: userId, p_seat: seat });
    if (error) throw error;
    return data === true;
  },
  async openBoard() {
    const { data, error } = await admin.rpc('open_board');
    if (error) throw error;
    return (data as string | null) ?? null;
  },
  async takeSeat(boardId: string, doc: unknown, version: number, userId: string, seat: number) {
    const { data, error } = await admin.rpc('take_seat', {
      p_id: boardId, p_doc: doc, p_version: version, p_user: userId, p_seat: seat,
    });
    if (error) throw error;
    return data === true;
  },
  async claimNickname(userId: string, nickname: string) {
    const { data, error } = await admin.rpc('claim_nickname', { p_user: userId, p_nickname: nickname });
    if (error) throw error;
    return (data as string | null) ?? null;
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
    const served = await serveWorld(store, auth.user.id, body, Date.now());
    return served.status === 200 ? json(200, served.reply) : json(served.status, { error: served.error });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'the world server failed' });
  }
});
