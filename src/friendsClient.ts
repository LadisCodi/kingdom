// THE FRIENDS LIST, from the game's side (Docs/features/15-social.md §2.1):
// what the social server last said, what the screen has typed and opened,
// and the commands the screen sends. Held by the Game (`game.friends`); the
// screens in ui/friends/ only read it and call it.
//
// The friends are server state. The client keeps the last snapshot, says
// hello now and then — more often while the screen is open — and redraws on
// every answer. Nothing of it lives in the save.

import type { Game } from './game';
import { townhall } from './sim/state';
import type { SocialServerApi } from './socialServer/local';
import type { KingdomView, SocialCommand, SocialRefusal, SocialSnapshot } from './socialServer/types';
import { nicknameProblem } from './worldServer/nickname';
import { formatExact } from './ui/format';

/** The requests panel's three tabs. */
export type RequestsTab = 'received' | 'sent' | 'suggested';

/** A kingdom on the friends list as the screen ranks it. */
export interface RankedKingdom extends KingdomView {
  /** 1, 2 or 3 for the podium; null past it. */
  rank: number | null;
  isMe: boolean;
}

/** What a refusal says to the player. */
export const REFUSAL_WORDS: Record<SocialRefusal, string> = {
  NoName: 'Choose your name first',
  BadNickname: 'That name cannot be used',
  NicknameTaken: 'Another kingdom has that name',
  NotFound: 'No kingdom answers to that',
  Self: 'That is your own kingdom',
  AlreadyFriends: 'You are friends already',
  Full: 'Your friends list is full',
  TheirFull: 'Their friends list is full',
  TooManySent: 'Too many requests are waiting for an answer',
  Offline: 'The messengers could not get through. Try again soon',
};

/** How often the client says hello: on the screen, and anywhere else. */
const HELLO_OPEN_S = 10;
const HELLO_AWAY_S = 60;

export class FriendsClient {
  /** The server's last word; null until the first answer. */
  snap: SocialSnapshot | null = null;
  /** The last search's finds; null when nothing has been searched. */
  found: KingdomView[] | null = null;
  query = '';
  tab: RequestsTab = 'received';
  /** The friend whose profile is open, by code. */
  openCode: string | null = null;
  /** The profile's remove, waiting for its confirmation. */
  confirmingRemove = false;
  /** Codes with a command on its way: their buttons wait. */
  busy = new Set<string>();
  searching = false;
  /** The nickname step (the first visit). */
  nicknameDraft = '';
  nicknameRefused: string | null = null;
  naming = false;
  /** A code from an invitation link, to search the first time the screen
   *  can (`?friend=`). */
  invitedBy: string | null = null;
  /** The screen has come in since it was opened: a rebuild does not play
   *  the entrance again. */
  settled = false;
  private ticks = 0;
  private saying = false;

  constructor(private game: Game, public server: SocialServerApi | null) {}

  // ------------------------------------------------------------ reading

  /** The player has a name the server knows them by. */
  named(): boolean {
    return this.snap?.me !== null && this.snap?.me !== undefined;
  }

  /** The player and their friends, furthest on first; the first three on
   *  the podium. */
  ranked(): RankedKingdom[] {
    const me = this.snap?.me;
    if (me === null || me === undefined) return [];
    const all = [{ ...me, isMe: true }, ...this.snap!.friends.map((f) => ({ ...f, isMe: false }))]
      .sort((a, b) => b.townhall - a.townhall || b.cells - a.cells || Number(b.isMe) - Number(a.isMe)
        || a.nickname.localeCompare(b.nickname));
    return all.map((k, i) => ({ ...k, rank: all.length > 1 && i < 3 ? i + 1 : null }));
  }

  /** The friend whose profile is open. */
  opened(): RankedKingdom | null {
    return this.ranked().find((k) => !k.isMe && k.code === this.openCode) ?? null;
  }

  /** What the header button's dot counts: requests to answer. */
  badge(): number {
    return this.snap?.incoming.length ?? 0;
  }

  // ------------------------------------------------------------ the clock

  /** Once a second from the game's tick. */
  tick(): void {
    if (this.server === null || !this.game.doorOpen('friends')) return;
    this.ticks += 1;
    const open = this.game.openOverlay === 'friends' || this.game.openOverlay === 'friendProfile';
    if (this.ticks % (open ? HELLO_OPEN_S : HELLO_AWAY_S) === 1) void this.hello();
  }

  /** Say the player is here, and read everything. */
  async hello(): Promise<void> {
    if (this.server === null || this.saying) return;
    this.saying = true;
    try {
      const s = this.game.state;
      await this.send({ kind: 'hello', progress: { townhall: townhall(s).level, cells: Object.keys(s.fog.revealed).length } });
    } finally {
      this.saying = false;
    }
    // A kingdom that went out onto the world board has a name already: the
    // friends list takes the same one rather than asking again.
    const worldName = this.game.worldNickname();
    if (this.snap !== null && this.snap.me === null && worldName !== null && !this.naming) await this.takeName(worldName);
    if (this.named() && this.invitedBy !== null) {
      const code = this.invitedBy;
      this.invitedBy = null;
      await this.search(code);
    }
  }

  // ------------------------------------------------------------ commands

  /** Open the friends screen, fresh. */
  open(): void {
    this.openCode = null;
    this.confirmingRemove = false;
    this.settled = false;
    this.game.setOverlay('friends');
    void this.hello();
  }

  async takeName(nickname: string): Promise<void> {
    if (this.server === null || this.naming) return;
    this.nicknameDraft = nickname;
    const problem = nicknameProblem(nickname);
    if (problem !== null) {
      this.nicknameRefused = problem;
      this.game.notify();
      return;
    }
    this.naming = true;
    this.nicknameRefused = null;
    this.game.notify();
    const r = await this.server.send({ kind: 'name', nickname });
    this.naming = false;
    if (r.snapshot !== null) this.snap = r.snapshot;
    if (!r.ok) this.nicknameRefused = REFUSAL_WORDS[r.why];
    else {
      this.game.track('friends_named');
      // The screen arrives now (§2.1); a hello brings whatever was waiting.
      this.settled = false;
      await this.hello();
    }
    this.game.notify();
  }

  async search(query: string): Promise<void> {
    this.query = query;
    if (query.trim() === '') {
      this.found = null;
      this.game.notify();
      return;
    }
    this.searching = true;
    this.game.notify();
    const r = await this.send({ kind: 'search', query });
    this.searching = false;
    this.found = r?.ok ? r.found ?? [] : this.found;
    this.game.notify();
  }

  request(code: string): Promise<void> { return this.act(code, { kind: 'request', code }, 'Request sent'); }
  accept(code: string): Promise<void> { return this.act(code, { kind: 'accept', code }, null); }
  decline(code: string): Promise<void> { return this.act(code, { kind: 'decline', code }, null); }
  cancel(code: string): Promise<void> { return this.act(code, { kind: 'cancel', code }, null); }

  async remove(code: string): Promise<void> {
    await this.act(code, { kind: 'remove', code }, null);
    this.confirmingRemove = false;
    if (this.openCode === code) {
      this.openCode = null;
      this.game.setOverlay('friends');
    }
  }

  /** Show a friend's profile. */
  openProfile(code: string): void {
    this.openCode = code;
    this.confirmingRemove = false;
    this.game.setOverlay('friendProfile');
  }

  closeProfile(): void {
    this.openCode = null;
    this.confirmingRemove = false;
    this.game.setOverlay('friends');
  }

  /** Share the player's code — through the phone's own share sheet where
   *  there is one, else onto the clipboard. */
  async invite(): Promise<void> {
    const code = this.snap?.me?.code;
    if (code === undefined) return;
    const link = `${location.origin}${location.pathname}?friend=${encodeURIComponent(code)}`;
    const text = `Rule beside me in Kingdom! Add me as a friend with my code ${code}`;
    this.game.track('friends_invited');
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Kingdom', text, url: link });
        return;
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // the player closed the sheet
    }
    try {
      await navigator.clipboard.writeText(`${text}: ${link}`);
      this.game.toast('Invitation copied — paste it to a friend');
    } catch {
      this.game.toast(`Your friend code is ${code}`);
    }
  }

  /** The code alone onto the clipboard. */
  async copyCode(): Promise<void> {
    const code = this.snap?.me?.code;
    if (code === undefined) return;
    try {
      await navigator.clipboard.writeText(code);
      this.game.toast('Friend code copied');
    } catch {
      this.game.toast(`Your friend code is ${code}`);
    }
  }

  // ------------------------------------------------------------ plumbing

  private async act(code: string, cmd: SocialCommand, okWords: string | null): Promise<void> {
    if (this.busy.has(code)) return;
    this.busy.add(code);
    this.game.notify();
    const r = await this.send(cmd);
    this.busy.delete(code);
    if (r !== null && !r.ok) this.game.toast(REFUSAL_WORDS[r.why]);
    else if (r !== null) {
      if (okWords !== null) this.game.toast(okWords);
      this.game.track(`friend_${cmd.kind}`);
    }
    this.game.notify();
  }

  private async send(cmd: SocialCommand) {
    if (this.server === null) return null;
    const r = await this.server.send(cmd);
    if (r.snapshot !== null) this.snap = r.snapshot;
    if (!r.ok && r.why === 'Offline' && cmd.kind !== 'hello') this.game.toast(REFUSAL_WORDS.Offline);
    this.game.notify();
    return r;
  }
}

/** When a kingdom was last in the game, as a friend reads it: roughly. */
export function lastSeenWords(seenAt: number | null, now: number): string {
  if (seenAt === null) return 'Not seen yet';
  const ms = Math.max(0, now - seenAt);
  const min = 60_000;
  const day = 24 * 60 * min;
  if (ms < 5 * min) return 'Online now';
  const then = new Date(seenAt);
  const today = new Date(now);
  const sameDay = then.toDateString() === today.toDateString();
  if (sameDay) return 'Today';
  const yesterday = new Date(now - day);
  if (then.toDateString() === yesterday.toDateString()) return 'Yesterday';
  if (ms < 7 * day) return 'This week';
  if (ms < 14 * day) return '1 week ago';
  if (ms < 30 * day) return `${formatExact(Math.floor(ms / (7 * day)))} weeks ago`;
  const months = Math.floor(ms / (30 * day));
  return months === 1 ? '1 month ago' : `${formatExact(months)} months ago`;
}
