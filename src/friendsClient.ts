// THE FRIENDS LIST, from the game's side (Docs/features/15-social.md §2.1):
// what the social server last said, what the screen has typed and opened,
// and the commands the screen sends. Held by the Game (`game.friends`); the
// screens in ui/friends/ only read it and call it.
//
// The friends are server state. The client keeps the last snapshot, says
// hello now and then — more often while the screen is open — and redraws on
// every answer. Nothing of it lives in the save.

import type { Game } from './game';
import type { Crest } from './sim/crest';
import { fillProblem, giveProblem, lotKey, pairs, receiveLot, takeLot, type TradeLot } from './sim/trade';
import { townhall } from './sim/state';
import { helpMana, payHelper, receiveGift } from './sim/friendHelp';
import type { SocialServerApi } from './socialServer/local';
import type { KingdomView, SocialCommand, SocialRefusal, SocialSnapshot, WishView } from './socialServer/types';
import { nicknameProblem } from './worldServer/nickname';
import { normalCode } from './socialServer/serve';
import { formatExact } from './ui/format';
import { tr, trn } from './i18n/tr';

/** The friends screen's three tabs. */
export type FriendsTab = 'list' | 'trade' | 'inbox';

/** Where the search popup stands: being typed, sending, or answered. */
export type SearchStage = 'typing' | 'sending' | 'sent';

/** A kingdom on the friends list as the screen ranks it. */
export interface RankedKingdom extends KingdomView {
  /** 1, 2 or 3 for the podium; null past it. */
  rank: number | null;
  isMe: boolean;
}

/** What a refusal says to the player. */
export const REFUSAL_WORDS: Record<SocialRefusal, string> = {
  NoName: tr('Choose your name first'),
  BadNickname: tr('That name cannot be used'),
  NicknameTaken: tr('Another kingdom has that name'),
  NotFound: tr('There is no kingdom with that name or code'),
  Self: tr('That is your own kingdom'),
  AlreadyFriends: tr('You are friends already'),
  Full: tr('Your friends list is full'),
  TheirFull: tr('Their friends list is full'),
  TooManySent: tr('Too many requests are waiting for an answer'),
  Offline: tr('The messengers could not get through. Try again soon'),
  BadWish: tr('Those two cannot be traded for each other'),
  TooManyWishes: tr('You have as many wishes pinned as you may'),
  SameWish: tr('You already wish for that'),
  WishGone: tr('That wish is gone'),
  OwnWish: tr('That wish is your own'),
  NotFriends: tr('Only friends can fill each other\'s wishes'),
  NoFillsLeft: tr('No fills left today'),
  AlreadyHelped: tr('You have helped them today'),
  NoHelpsLeft: tr('No helps left today'),
};

/** Why the player cannot fill a wish, in words (sim/trade.ts `fillProblem`). */
export const FILL_WORDS = {
  NotEnough: tr('You don\'t have it'),
  OnlyOne: tr('You have only one'),
  Bound: tr('Only found fragments can be given'),
  Unmet: tr('You have not found this relic yet'),
} as const;

/** How often the client says hello: on the screen, and anywhere else. */
const HELLO_OPEN_S = 10;
const HELLO_AWAY_S = 60;

export class FriendsClient {
  /** The server's last word; null until the first answer. */
  snap: SocialSnapshot | null = null;
  tab: FriendsTab = 'list';
  /** The search popup: what is typed, where it stands, why the server said
   *  no, and who a request went to. */
  searchDraft = '';
  searchStage: SearchStage = 'typing';
  searchRefused: string | null = null;
  sentTo: KingdomView | null = null;
  /** The wish being made: what is needed (step 1), what is given (step 2). */
  wishNeed: TradeLot | null = null;
  wishGive: TradeLot | null = null;
  /** The wish the player just filled, for its window. */
  justFilled: { owner: KingdomView; gave: TradeLot; got: TradeLot } | null = null;
  /** Messages read on this visit to the Inbox: they stay under New until
   *  the player leaves it, rather than jumping as they are read. */
  readThisVisit = new Set<string>();
  /** The friend whose profile is open, by code. */
  openCode: string | null = null;
  /** The shield editor's crest, picked and not yet saved; null when it
   *  shows the one the kingdom wears. */
  crestDraft: Crest | null = null;
  /** The profile's remove, waiting for its confirmation. */
  confirmingRemove = false;
  /** Codes with a command on its way: their buttons wait. */
  busy = new Set<string>();
  /** The nickname step (the first visit). */
  nicknameDraft = '';
  nicknameRefused: string | null = null;
  naming = false;
  /** A code from an invitation link, put in the search popup the first
   *  time the screen opens (`?friend=`). */
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
    // The player's own crest is the save's: the server may not have heard
    // the latest yet.
    const all = [{ ...me, crest: this.game.state.kingdom.profile.crest, isMe: true }, ...this.snap!.friends.map((f) => ({ ...f, isMe: false }))]
      .sort((a, b) => b.townhall - a.townhall || b.cells - a.cells || Number(b.isMe) - Number(a.isMe)
        || a.nickname.localeCompare(b.nickname));
    return all.map((k, i) => ({ ...k, rank: all.length > 1 && i < 3 ? i + 1 : null }));
  }

  /** The friend whose profile is open. */
  opened(): RankedKingdom | null {
    return this.ranked().find((k) => !k.isMe && k.code === this.openCode) ?? null;
  }

  /** Inbox messages not yet read — a request is, until it is answered. */
  unread(): number {
    return (this.snap?.inbox ?? []).filter((m) => m.readAt === null).length;
  }

  /** Friends' wishes the player can fill now. */
  fillable(): WishView[] {
    const snap = this.snap;
    if (snap === null || snap.fillsLeft <= 0) return [];
    return snap.friendWishes.filter((w) => fillProblem(this.game.state, w.need, w.give) === null);
  }

  /** What the header button's dot counts: requests to answer, any other
   *  message not yet read (a request is both, and counts once), and
   *  friends' wishes the player can fill. */
  badge(): number {
    const snap = this.snap;
    if (snap === null) return 0;
    const otherUnread = snap.inbox.filter((m) => m.readAt === null && m.state !== 'pending').length;
    return snap.incoming.length + otherUnread + this.fillable().length;
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
      await this.send({
        kind: 'hello',
        progress: {
          townhall: townhall(s).level, cells: Object.keys(s.fog.revealed).length, crest: s.kingdom.profile.crest,
          ack: s.kingdom.trade.seq,
        },
      });
    } finally {
      this.saying = false;
    }
    // A kingdom that went out onto the world board has a name already: the
    // friends list takes the same one rather than asking again.
    const worldName = this.game.worldNickname() ?? this.game.state.kingdom.profile.nickname;
    if (this.snap !== null && this.snap.me === null && worldName !== null && !this.naming) await this.takeName(worldName);
    if (this.named() && this.invitedBy !== null && this.game.openOverlay === 'friends') {
      const code = this.invitedBy;
      this.invitedBy = null;
      this.openSearch(code);
    }
  }

  // ------------------------------------------------------------ commands

  /** Open the friends screen, fresh. */
  open(): void {
    this.openCode = null;
    this.confirmingRemove = false;
    this.settled = false;
    this.tab = 'list';
    this.readThisVisit.clear();
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

  // ------------------------------------------------------------ the search popup

  /** Open the popup, empty or with a code from an invitation. */
  openSearch(prefill = ''): void {
    this.searchDraft = prefill;
    this.searchStage = 'typing';
    this.searchRefused = null;
    this.sentTo = null;
    this.game.setOverlay('friendSearch');
  }

  closeSearch(): void {
    this.game.setOverlay('friends');
  }

  /** What is typed can be asked for: a nickname's shape, or a code's. */
  searchValid(): boolean {
    const t = this.searchDraft.trim();
    return t !== '' && (normalCode(t) !== null || nicknameProblem(t) === null);
  }

  /** Add: the request goes straight to the kingdom named. */
  async sendSearch(): Promise<void> {
    if (!this.searchValid() || this.searchStage === 'sending') return;
    this.searchStage = 'sending';
    this.searchRefused = null;
    this.game.notify();
    const r = await this.send({ kind: 'request', target: this.searchDraft.trim() });
    if (r !== null && r.ok) {
      this.searchStage = 'sent';
      this.sentTo = r.to ?? null;
      this.game.track('friend_request', { from: 'search' });
    } else {
      this.searchStage = 'typing';
      this.searchRefused = REFUSAL_WORDS[r?.why ?? 'Offline'];
    }
    this.game.notify();
  }

  /** A suggestion's +: the same request, by its code. */
  request(code: string): Promise<void> { return this.act(code, { kind: 'request', target: code }, null); }
  accept(code: string): Promise<void> { return this.act(code, { kind: 'accept', code }, null); }
  decline(code: string): Promise<void> { return this.act(code, { kind: 'decline', code }, null); }

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

  openCrestEditor(): void {
    this.crestDraft = null;
    this.game.setOverlay('crestEditor');
  }

  closeCrestEditor(): void {
    this.crestDraft = null;
    this.game.setOverlay('friends');
  }

  saveCrest(): void {
    if (this.crestDraft !== null) this.game.setMyCrest(this.crestDraft);
    this.closeCrestEditor();
  }

  closeProfile(): void {
    this.openCode = null;
    this.confirmingRemove = false;
    this.game.setOverlay('friends');
  }

  // ------------------------------------------------------------ the Inbox

  /** Switch tabs. Opening the Inbox reads what is new in it. */
  setTab(tab: FriendsTab): void {
    this.tab = tab;
    if (tab === 'inbox') void this.readInbox();
    else this.readThisVisit.clear();
    this.game.notify();
  }

  private async readInbox(): Promise<void> {
    const ids = (this.snap?.inbox ?? []).filter((m) => m.readAt === null && m.state !== 'pending').map((m) => m.id);
    if (ids.length === 0) return;
    for (const id of ids) this.readThisVisit.add(id);
    await this.send({ kind: 'read', ids });
  }

  async deleteRead(): Promise<void> {
    await this.send({ kind: 'deleteRead' });
    this.game.track('inbox_cleared');
  }

  // ------------------------------------------------------------ the wish board

  /** Step 1: what the player needs. */
  openWishNeed(): void {
    this.wishNeed = null;
    this.wishGive = null;
    this.game.setOverlay('wishNeed');
  }

  /** A need picked: on to step 2. */
  pickNeed(l: TradeLot): void {
    this.wishNeed = l;
    this.wishGive = null;
    this.game.setOverlay('wishGive');
  }

  pickGive(l: TradeLot): void {
    this.wishGive = l;
    this.game.notify();
  }

  /** Back to the Trade tab, the wish unmade. */
  closeWish(): void {
    this.wishNeed = null;
    this.wishGive = null;
    this.tab = 'trade';
    this.game.setOverlay('friends');
  }

  /** Pin the wish: its stake leaves the player's goods now, and comes back
   *  if the server says no. */
  async pinWish(): Promise<void> {
    const need = this.wishNeed;
    const give = this.wishGive;
    if (need === null || give === null || !pairs(need, give) || giveProblem(this.game.state, give) !== null) return;
    takeLot(this.game.state, give);
    const r = await this.send({ kind: 'pinWish', need, give });
    if (r === null || !r.ok) {
      receiveLot(this.game.state, give);
      if (r !== null && !r.ok && r.why !== 'Offline') this.game.toast(REFUSAL_WORDS[r.why]);
      this.game.notify();
      return;
    }
    this.game.track('wish_pinned', { need: lotKey(need), give: lotKey(give) });
    this.closeWish();
  }

  /** Take a wish down: its stake comes back as a delivery. */
  async withdrawWish(id: string): Promise<void> {
    await this.act(id, { kind: 'withdrawWish', id }, null);
  }

  /** Fill a friend's wish: what it needs leaves the player's goods once the
   *  server has said yes; its stake comes as a delivery. */
  async fillWish(w: WishView): Promise<void> {
    const problem = fillProblem(this.game.state, w.need, w.give);
    if (problem !== null) {
      this.game.toast(FILL_WORDS[problem]);
      return;
    }
    if (this.busy.has(w.id)) return;
    this.busy.add(w.id);
    this.game.notify();
    const r = await this.send({ kind: 'fillWish', id: w.id });
    this.busy.delete(w.id);
    if (r === null || !r.ok) {
      if (r !== null && !r.ok && r.why !== 'Offline') this.game.toast(REFUSAL_WORDS[r.why]);
      this.game.notify();
      return;
    }
    takeLot(this.game.state, w.need);
    this.game.track('wish_filled', { need: lotKey(w.need), give: lotKey(w.give) });
    this.justFilled = { owner: w.owner, gave: w.need, got: w.give };
    this.game.setOverlay('wishFilled');
  }

  /** Help a friend (§3): paid on the server's yes, once a day each. */
  async help(code: string): Promise<void> {
    if (this.busy.has(code)) return;
    this.busy.add(code);
    this.game.notify();
    const r = await this.send({ kind: 'help', code });
    this.busy.delete(code);
    if (r === null || !r.ok) {
      if (r !== null && !r.ok && r.why !== 'Offline') this.game.toast(REFUSAL_WORDS[r.why]);
      this.game.notify();
      return;
    }
    const banked = payHelper(this.game.state);
    this.game.track('friend_helped', { mana: banked });
    this.game.toast(banked > 0 ? tr('Helped · +{n} Mana', { n: formatExact(banked) }) : tr('Helped · your Mana is full'));
    this.game.persist?.();
    this.game.notify();
  }

  /** When a friend may be helped again, or null if they may be now. */
  helpedAt(code: string): number | null {
    return this.snap?.helped.find((h) => h.code === code)?.at ?? null;
  }

  /** What a help pays the player now. */
  helpPay(): number { return helpMana(this.game.state); }

  closeFilled(): void {
    this.justFilled = null;
    this.tab = 'trade';
    this.game.setOverlay('friends');
  }

  /** What the server hands over — applied once each, in order, saved, and
   *  acknowledged with the next hello. */
  private applyDeliveries(): void {
    const s = this.game.state;
    const fresh = (this.snap?.deliveries ?? []).filter((d) => d.seq > s.kingdom.trade.seq);
    if (fresh.length === 0) return;
    for (const d of fresh) {
      if (d.lot.kind === 'gift') receiveGift(s, d.lot.item);
      else receiveLot(s, d.lot);
      s.kingdom.trade.seq = d.seq;
    }
    this.game.persist?.();
    this.game.notify();
  }

  /** Share the player's code — through the phone's own share sheet where
   *  there is one, else onto the clipboard. */
  async invite(): Promise<void> {
    const code = this.snap?.me?.code;
    if (code === undefined) return;
    const link = `${location.origin}${location.pathname}?friend=${encodeURIComponent(code)}`;
    const text = tr('Rule beside me in Kingdom! Add me as a friend with my code {code}', { code });
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
      this.game.toast(tr('Invitation copied — paste it to a friend'));
    } catch {
      this.game.toast(tr('Your friend code is {code}', { code }));
    }
  }

  /** The code alone onto the clipboard. */
  async copyCode(): Promise<void> {
    const code = this.snap?.me?.code;
    if (code === undefined) return;
    try {
      await navigator.clipboard.writeText(code);
      this.game.toast(tr('Friend code copied'));
    } catch {
      this.game.toast(tr('Your friend code is {code}', { code }));
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
    if (r.snapshot !== null) {
      this.snap = r.snapshot;
      this.applyDeliveries();
    }
    if (!r.ok && r.why === 'Offline' && cmd.kind !== 'hello') this.game.toast(REFUSAL_WORDS.Offline);
    this.game.notify();
    return r;
  }
}

/** When a kingdom was last in the game, as a friend reads it: roughly. */
export function lastSeenWords(seenAt: number | null, now: number): string {
  if (seenAt === null) return tr('Not seen yet');
  const ms = Math.max(0, now - seenAt);
  const min = 60_000;
  const day = 24 * 60 * min;
  if (ms < 5 * min) return tr('Online now');
  const then = new Date(seenAt);
  const today = new Date(now);
  const sameDay = then.toDateString() === today.toDateString();
  if (sameDay) return tr('Today');
  const yesterday = new Date(now - day);
  if (then.toDateString() === yesterday.toDateString()) return tr('Yesterday');
  if (ms < 7 * day) return tr('This week');
  if (ms < 14 * day) return tr('1 week ago');
  if (ms < 30 * day) return tr('{n} weeks ago', { n: formatExact(Math.floor(ms / (7 * day))) });
  const months = Math.floor(ms / (30 * day));
  return trn(months, '{n} month ago', '{n} months ago', { n: formatExact(months) });
}
