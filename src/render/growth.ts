// Which growth drawing a planted feature shows (Docs/features/27-plantables.md
// §2). DOM-free, so it is testable under node; `sprites.ts` hands it the
// lookup of what art is on disk.

/** How many stages each stem has drawn: `<stem>_growing1`, `_growing2`… —
 *  counted once from the files, so a stage lands with its art. */
const counts = new Map<string, number>();

export function pickGrowthStage(
  stem: string, progress: number, has: (key: string) => boolean,
): string | null {
  let n = counts.get(stem);
  if (n === undefined) {
    n = 0;
    while (has(`${stem}_growing${n + 1}`)) n++;
    counts.set(stem, n);
  }
  if (n === 0) return null;
  return `${stem}_growing${Math.min(n, Math.floor(progress * n) + 1)}`;
}
