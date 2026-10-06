// THE REAL SOCIAL SERVER, from the client's side: every request sent to the
// `social` edge function, which answers it with the same `serveSocial` the
// local stand-in runs (Docs/plans/online-server.md §1, step 5).
//
// Every command is idempotent by what it says, so a request whose answer was
// lost is simply sent again. One that cannot get through at all is refused
// as Offline — never thrown.

import type { SocialServerApi } from './local';
import type { SocialCommand, SocialReply } from './types';

/** One trip to the server: its answer, or whether trying again could help. */
export type SocialCall = (body: { cmd: SocialCommand }) =>
  Promise<{ ok: true; data: unknown } | { ok: false; retry: boolean; error: string }>;

const TRIES = 3;
const FIRST_WAIT_MS = 400;

export class RemoteSocialServer implements SocialServerApi {
  constructor(
    private call: SocialCall,
    private wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  async send(cmd: SocialCommand): Promise<SocialReply> {
    let last = '';
    for (let n = 0; n < TRIES; n++) {
      if (n > 0) await this.wait(FIRST_WAIT_MS * 2 ** (n - 1));
      const r = await this.call({ cmd });
      if (r.ok) return r.data as SocialReply;
      last = r.error;
      if (!r.retry) break;
    }
    console.warn(`kingdom: the social server did not answer ${cmd.kind}: ${last}`);
    return { ok: false, why: 'Offline', snapshot: null };
  }
}
