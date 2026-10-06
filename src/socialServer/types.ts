// What the social server says and is asked (Docs/features/15-social.md §2.1).
//
// A kingdom is known to other players by its FRIEND CODE, never by the
// account behind it: every view and every command names a code, so no
// client ever holds another player's user id.

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
   *  then others lately in the game. */
  suggestions: KingdomView[];
}

/** How far a kingdom has come, and the crest it wears, reported by its
 *  own client. A client from before crests sends none, and leaves the
 *  profile's as it was. */
export interface SocialProgress {
  townhall: number;
  cells: number;
  crest?: string | null;
}

/** Why a command was refused. */
export type SocialRefusal =
  | 'NoName' | 'BadNickname' | 'NicknameTaken' | 'NotFound' | 'Self' | 'AlreadyFriends'
  | 'Full' | 'TheirFull' | 'TooManySent' | 'Offline';

/** Everything a client can ask of the social server. */
export type SocialCommand =
  /** Say the player is here and how far they have come; read everything. */
  | { kind: 'hello'; progress: SocialProgress }
  /** Take a nickname — the same one the world board knows them by. */
  | { kind: 'name'; nickname: string }
  /** Find kingdoms by friend code or by the start of a nickname. */
  | { kind: 'search'; query: string }
  /** Ask a kingdom to be friends; if it already asked, that is a yes. */
  | { kind: 'request'; code: string }
  | { kind: 'accept'; code: string }
  | { kind: 'decline'; code: string }
  /** Take back a request not yet answered. */
  | { kind: 'cancel'; code: string }
  | { kind: 'remove'; code: string };

export type SocialCommandKind = SocialCommand['kind'];

/** Every answer: whether it took, and the state after it. A search also
 *  carries what it found. */
export type SocialReply =
  | { ok: true; snapshot: SocialSnapshot; found?: KingdomView[] }
  | { ok: false; why: SocialRefusal; snapshot: SocialSnapshot | null };
