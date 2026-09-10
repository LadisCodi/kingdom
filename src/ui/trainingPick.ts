// Which trainee each building's card is showing. Module-level so it survives
// a rebuild of the card — the same reason the research tree keeps its
// selection — and in a file of its own so the card's SIGNATURE can read it
// without importing the section, which reaches the sprite loader and so the
// DOM. Nothing here touches either.
import type { TrainableId } from '../sim/state';

const picked = new Map<string, TrainableId>();

/** What this building's card is showing, if the player has chosen. */
export const pickedTrainee = (districtId: string): TrainableId | undefined =>
  picked.get(districtId);

/** The player chose a trainee to read about. */
export const pickTrainee = (districtId: string, trainee: TrainableId): void => {
  picked.set(districtId, trainee);
};
