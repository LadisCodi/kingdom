// Runs before every test file (vite.config.ts › test.setupFiles).
//
// Numbers are written in the viewer's locale (src/ui/format.ts), so a test
// that reads a printed number would pass or fail by the machine it runs on.
// The suite reads them in English; tests/numberFormat.test.ts covers the rest.
import { setNumberLocale } from '../src/ui/format';

setNumberLocale('en-US');
