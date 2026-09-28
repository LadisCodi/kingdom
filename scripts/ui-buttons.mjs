// The label buttons' two DERIVED states: highlight and disabled.
//
//   node scripts/ui-buttons.mjs        (npm run art:buttons)
//
// Every button material ships four states (Docs/art/ui-menus-redesign.md
// §3.3): NORMAL and PRESSED are drawn — they are two poses of the material —
// and HIGHLIGHT and DISABLED are derived from the normal art here, so the
// four are pixel-identical in outline and a button never shifts as it
// changes state (the atlas derives its -locked icons the same way):
//
//   btn-<m>.png          normal       drawn (sheets/ui-buttons1-gems.png, ui-quest1-…,
//                                     and ui-buttons3-paint.png for btn-paint-<colour>)
//   btn-<m>-down.png     pressed      drawn
//   btn-<m>-hover.png    highlight    derived: brighter, a touch warmer
//   btn-<m>-off.png      disabled     derived: desaturated toward a muted blue-grey
//
// and the same four for the ROUND set, knob-<m>[-state].png
// (sheets/ui-buttons2-round.png, ui-buttons4-round-paint.png).
//
// Needs ImageMagick. Not in prebuild; outputs are committed.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'src/ui/assets');
const MATERIALS = ['wood', 'green', 'blue', 'gold', 'red', 'purple'];
/** The painted colours, for both shapes. */
const PAINTS = ['paint-green', 'paint-blue', 'paint-gold', 'paint-red', 'paint-purple'];

const magick = (...args) => execFileSync('magick', args.map(String), { stdio: 'inherit' });

for (const shape of ['btn', 'knob']) {
  for (const m of [...MATERIALS, ...PAINTS]) {
    const src = join(ASSETS, `${shape}-${m}.png`);
    if (!existsSync(src)) {
      console.error(`ui-buttons: missing ${src}`);
      process.exit(1);
    }
    // Highlight: 10% brighter, 8% more saturated — lit, not recoloured.
    magick(src, '-modulate', '110,108', join(ASSETS, `${shape}-${m}-hover.png`));
    // Disabled: almost all colour drained, a little darker, then washed toward
    // a cool slate so it reads as "not now" on warm parchment without turning
    // into flat grey. Alpha is untouched: -colorize only moves the colour.
    magick(src, '-modulate', '94,14', '-fill', '#7d8aa3', '-colorize', '24%',
      join(ASSETS, `${shape}-${m}-off.png`));
    console.log(`ui-buttons: ${shape}-${m} → hover, off`);
  }
}
