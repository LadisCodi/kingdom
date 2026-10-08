// TEXT IN THE PLAYER'S LANGUAGE (Docs/features/28-languages.md §2).
//
// The ENGLISH IS THE KEY: `tr('Start over')` reads as it did before, and the
// Spanish catalog (`es/*.json`) maps that English to its Spanish. What the
// catalog lacks is shown in English. A value is filled with `{name}`
// placeholders, which the caller hands in already formatted (src/ui/format.ts):
// this module writes no number itself.
//
// `trn` picks a plural: the English is `one|other`, and so is the Spanish.
//
// tests/i18n.test.ts holds every `tr('…')` and `trn(…)` in the source to an
// entry in the Spanish catalog — so the English is always a literal, never a
// variable. (Not `t`: the sim calls its time `t`.)

import { currentLang } from './lang';
import { ES } from './catalog';

export type Vars = Record<string, string | number>;

const fill = (s: string, vars?: Vars): string => (vars === undefined ? s
  : s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)));

/** A key may carry a CONTEXT before `::` — `tr('builder::Free')` — when one
 *  English word is two in Spanish (*Libre* / *Gratis*). The English shown is
 *  what follows it. */
const english = (key: string): string => {
  const at = key.lastIndexOf('::');
  return at < 0 ? key : key.slice(at + 2);
};

const translate = (key: string): string => (currentLang() === 'es' ? ES[key] || english(key) : english(key));

/** `en` in the player's language, its `{placeholders}` filled. */
export function tr(en: string, vars?: Vars): string {
  return fill(translate(en), vars);
}

const rules = new Map<string, Intl.PluralRules>();
const pluralOf = (n: number): 'one' | 'other' => {
  const l = currentLang();
  let r = rules.get(l);
  if (r === undefined) { r = new Intl.PluralRules(l); rules.set(l, r); }
  return r.select(n) === 'one' ? 'one' : 'other';
};

/** One of two forms, by `count`: `trn(n, '{n} villager', '{n} villagers', { n: formatCount(n) })`. */
export function trn(count: number, one: string, other: string, vars?: Vars): string {
  const [es1, esN] = (currentLang() === 'es' ? ES[`${one}|${other}`] ?? '' : '').split('|');
  const form = pluralOf(count) === 'one' ? (es1 || english(one)) : (esN || english(other));
  return fill(form, vars);
}
