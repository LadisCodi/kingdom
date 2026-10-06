// The crest's art (sim/crest.ts): a blank shield per tincture and a charge
// to lay on it, both on the same 144×160 canvas so they stack where they
// are. Read by the friends screens and by the world board's planks.

import type { Charge, Tincture } from '../sim/crest';

const urls = import.meta.glob('./assets/crest/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const at = (name: string): string | null => urls[`./assets/crest/${name}.png`] ?? null;

export const fieldUrl = (t: Tincture): string | null => at(`field-${t}`);
export const chargeUrl = (c: Charge): string | null => at(`charge-${c}`);
