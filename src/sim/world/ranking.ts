// The world ranking (Docs/features/19-world-map.md §12): the kingdoms of one
// world, ordered by how many hexes each holds. It pays nothing.
//
// Read off the snapshot the server last sent: a kingdom's hexes are its
// city and every hex whose district stands under it — one still being
// claimed does not count yet.

export interface RankedSeat {
  seat: number;
  name: string;
  crest: string | null;
  /** Its Townhall's level; null until its client has told the server. */
  townhall: number | null;
  you: boolean;
  friend: boolean;
  hexes: number;
  /** Its place: kingdoms with as many hexes share one (1, 2, 2, 4). */
  rank: number;
}

export interface RankingInput {
  seats: ReadonlyArray<{
    seat: number; name: string; you: boolean;
    crest?: string | null; townhall?: number | null; friend?: boolean;
    /** A free city's seat, which is not ranked. */
    free?: boolean;
  }>;
  hexes: ReadonlyArray<{ owner: number | null; held: boolean }>;
}

export function worldRanking(snap: RankingInput): RankedSeat[] {
  const held = new Map<number, number>();
  for (const h of snap.hexes) {
    if (h.owner !== null && h.held) held.set(h.owner, (held.get(h.owner) ?? 0) + 1);
  }
  const rows = snap.seats
    .filter((s) => s.free !== true)
    .map((s) => ({
      seat: s.seat, name: s.name, crest: s.crest ?? null, townhall: s.townhall ?? null,
      you: s.you, friend: s.friend === true, hexes: 1 + (held.get(s.seat) ?? 0), rank: 0,
    }))
    .sort((a, b) => b.hexes - a.hexes || a.seat - b.seat);
  rows.forEach((r, i) => { r.rank = i > 0 && rows[i - 1].hexes === r.hexes ? rows[i - 1].rank : i + 1; });
  return rows;
}

/** How far the player is from the next place up: the hexes between them
 *  and the nearest kingdom with more, and that kingdom's place; null when
 *  nobody has more. */
export function behind(rows: readonly RankedSeat[]): { hexes: number; rank: number } | null {
  const me = rows.find((r) => r.you);
  if (me === undefined) return null;
  const above = rows.filter((r) => r.hexes > me.hexes).pop();
  return above === undefined ? null : { hexes: above.hexes - me.hexes, rank: above.rank };
}
