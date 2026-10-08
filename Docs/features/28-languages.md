# 28 · Languages — English and Spanish

> **Scope.** The game in the player's language: which one, how the code's
> text and the data's text are translated, and how numbers follow it.
>
> **Status: building.** Built: the choice, the code's text, the data's short
> texts. Next: the tutorial dialogue (`scenes`), then the generated prose
> (technology cards, bonus sentences).

## 1. The choice

- Two languages: **English** and **Spanish** (Spain; the UI says *tú*, the
  cast calls the player *Majestad* and says *usted*).
- First boot: the first of the browser's languages the game speaks, else
  English.
- Settings › **Language**: each language named in itself (*English*,
  *Español*). Choosing one reloads the game in it.
- The choice lives on the device, not in the save.
- The data tools (`?dev=data`) are always in English: they edit the source.
- The world server and the tests read English.

## 2. The code's text

- Every text the code shows is `tr('English')`, or `trn(count, 'one', 'other')`
  for a plural. The English is the key; Spanish lives in
  `src/i18n/es/<area>.json`.
- One English word that is two in Spanish carries a context: `tr('builder::Free')`
  shows *Free* in English, *Libre* in Spanish (*Gratis* elsewhere).
- Placeholders are `{name}`, filled with numbers already formatted
  (`src/ui/format.ts`).
- What the catalog lacks shows in English.
- `tests/i18n.test.ts` refuses a `tr()` with no Spanish, a Spanish with other
  placeholders, a key in two areas, and a key the code no longer says.

## 3. The data's text

- The English in `src/sim/data/` is the source. The Spanish is an overlay per
  group (`src/i18n/es/data/<group>.json`): path → the English it was
  translated from, and the Spanish.
- The game reads a localized copy; a text whose English changed since shows in
  English until translated again.
- `npm run i18n:sync` adds new texts to the overlays, drops removed ones, and
  reports what is missing or stale.
- Localized: buildings (name, promise, description), goods, items, quests,
  store, speakers, unlock splashes, villains, world buildings, scene lines,
  lair flavour, ruins, technologies.

## 4. Numbers

- Written in the language's locale: *25,000* / *4.99* in English, *25.000* /
  *4,99* in Spanish.

## Dials, in the order to reach for them

| Dial | Where |
|---|---|
| A code text's Spanish | `src/i18n/es/<area>.json` |
| A data text's Spanish | `src/i18n/es/data/<group>.json`, after `npm run i18n:sync` |
| Which data fields are localized | `DATA_GROUPS`, `src/i18n/data.ts` |
| A new language | `Lang`, `LANG_NAMES`, `NUMBER_LOCALE` (`src/i18n/lang.ts`) and its catalogs |

## Deliberately not in this design

- Translating without a reload.
- Names the shared world generates (dungeons, rivals): every player on a
  board reads the same name.
- Latin-American Spanish as a separate language.
