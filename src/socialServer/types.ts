// What the social server says and is asked (Docs/features/15-social.md §2).
//
// A kingdom is known to other players by its FRIEND CODE, never by the
// account behind it: every view and every command names a code, so no
// client ever holds another player's user id.

import type { ItemId } from '../sim/state';
import type { TradeLot } from '../sim/trade';

/** Another kingdom as the friends screen draws it. */
export interface KingdomView {
  code: string;
  nickname: string;
  /** How far it has come: its Townhall's level, then its cells revealed. */
  townhall: number;
  cells: number;
  /** The crest it chose (`<tincture>.<charge>`, sim/crest.ts); null while
   *  it wears its nickname's. */
  crest: string | null;
  /** When it was last in the game, epoch ms; null if never. */
  seenAt: number | null;
}

/** A request waiting, either way, and when it was made. */
export interface RequestView extends KingdomView {
  at: number;
}

/** What an Inbox message is about. */
export type MessageKind =
  /** Someone asks to be friends: answered here as on the list. */
  | 'request'
  /** A request the player sent was accepted, or declined. */
  | 'accepted' | 'declined'
  /** A friend filled the player's wish; the player filled a friend's; a
   *  wish of the player's stood its hours unfilled (§2.4). */
  | 'wishFilled' | 'filledWish' | 'wishExpired'
  /** A friend helped the player, and left a gift in their Bag (§3). */
  | 'helped';

/** Where a request message stands. */
export type RequestState = 'pending' | 'accepted' | 'declined' | 'expired';

/** One message in the player's Inbox. */
export interface MessageView {
  id: string;
  kind: MessageKind;
  /** Who it is from. */
  from: KingdomView;
  /** When it arrived, epoch ms. */
  at: number;
  /** When the player read it; null while it is new. A request is read when
   *  it is answered. */
  readAt: number | null;
  /** A request's: null for any other kind. */
  state: RequestState | null;
  /** A trade's: what the player got and gave (a wish that expired got its
   *  stake back and gave nothing). */
  lots?: { got: TradeLot; gave: TradeLot | null };
  /** When it goes: a pending request's answer is due then; anything else
   *  is deleted then. */
  expiresAt: number;
}

/** A wish on the board (§2.4): what its owner needs, what they give for it
 *  — held by the server — and until when. */
export interface WishView {
  id: string;
  owner: KingdomView;
  need: TradeLot;
  give: TradeLot;
  at: number;
  expiresAt: number;
}

/** What a friend's help leaves in the player's Bag (§3). */
export interface GiftLot { kind: 'gift'; item: ItemId }

/** Goods the server hands the player: what a filled wish needed, a filled
 *  wish's stake, a wish's stake back, or a friend's gift. Sent until
 *  acknowledged (`ack` on a hello); the client applies each once, by `seq`. */
export interface DeliveryView {
  seq: number;
  lot: TradeLot | GiftLot;
  why: 'filled' | 'youFilled' | 'withdrawn' | 'expired' | 'helped';
}

/** The friends screen's whole state, as the server sees it now. */
export interface SocialSnapshot {
  /** The server's clock. */
  at: number;
  /** The player, or null before they have a nickname. */
  me: KingdomView | null;
  friends: KingdomView[];
  /** Asked of the player, newest first. */
  incoming: RequestView[];
  /** Asked by the player and not yet answered, newest first. */
  outgoing: RequestView[];
  /** Kingdoms the player might ask: neighbours on their world board first,
   *  then others lately in the game — only as many as fill the requests list
   *  to `FRIENDS.requestRows`. */
  suggestions: KingdomView[];
  /** The Inbox, newest first. */
  inbox: MessageView[];
  /** The player's own open wishes, oldest first. */
  wishes: WishView[];
  /** Every friend's open wishes, newest first. */
  friendWishes: WishView[];
  /** Friends' wishes the player may still fill in this 24 hours. */
  fillsLeft: number;
  /** Goods the server owes the player, oldest first. */
  deliveries: DeliveryView[];
  /** Friends the player has helped in this 24 hours, by code, and when (§3). */
  helped: Array<{ code: string; at: number }>;
  /** Friends the player may still help in this 24 hours. */
  helpsLeft: number;
}

/** How far a kingdom has come, and the crest it wears, reported by its
 *  own client. A client from before crests sends none, and leaves the
 *  profile's as it was. */
export interface SocialProgress {
  townhall: number;
  cells: number;
  crest?: string | null;
  /** The last delivery the client has applied and saved: the server stops
   *  sending it, and every one before it. */
  ack?: number;
}

/** Why a command was refused. */
export type SocialRefusal =
  | 'NoName' | 'BadNickname' | 'NicknameTaken' | 'NotFound' | 'Self' | 'AlreadyFriends'
  | 'Full' | 'TheirFull' | 'TooManySent' | 'Offline'
  /** Trading (§2.4). */
  | 'BadWish' | 'TooManyWishes' | 'SameWish' | 'WishGone' | 'OwnWish' | 'NotFriends' | 'NoFillsLeft'
  /** Daily help (§3). */
  | 'AlreadyHelped' | 'NoHelpsLeft';

/** Everything a client can ask of the social server. */
export type SocialCommand =
  /** Say the player is here and how far they have come; read everything. */
  | { kind: 'hello'; progress: SocialProgress }
  /** Take a nickname — the same one the world board knows them by. */
  | { kind: 'name'; nickname: string }
  /** Ask a kingdom to be friends, by its exact nickname or its friend code;
   *  if it already asked, that is a yes. */
  | { kind: 'request'; target: string }
  | { kind: 'accept'; code: string }
  | { kind: 'decline'; code: string }
  /** Take back a request not yet answered. */
  | { kind: 'cancel'; code: string }
  | { kind: 'remove'; code: string }
  /** These messages have been seen. */
  | { kind: 'read'; ids: string[] }
  /** Clear every read message that waits for nothing. */
  | { kind: 'deleteRead' }
  /** Pin a wish; its stake has already left the player's goods. */
  | { kind: 'pinWish'; need: TradeLot; give: TradeLot }
  /** Take one's own wish down: its stake comes back as a delivery. */
  | { kind: 'withdrawWish'; id: string }
  /** Fill a friend's wish; what it needs has already left the player's
   *  goods, and its stake comes as a delivery. */
  | { kind: 'fillWish'; id: string }
  /** Help a friend, once in any 24 hours: the helper is paid on the yes,
   *  the friend finds a gift (§3). */
  | { kind: 'help'; code: string };

export type SocialCommandKind = SocialCommand['kind'];

/** Every answer: whether it took, and the state after it. A request also
 *  says who it went to. */
export type SocialReply =
  | { ok: true; snapshot: SocialSnapshot; to?: KingdomView }
  | { ok: false; why: SocialRefusal; snapshot: SocialSnapshot | null };
