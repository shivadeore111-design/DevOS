'use strict';
const fs = require('fs');
let c = fs.readFileSync('C:/Users/shiva/DevOS/cloudflare-worker/landing.js', 'utf8');
const original = c;
const BS = String.fromCharCode(92);
const NL2 = BS + 'n' + BS + 'n';

// ── CHANGE 1: Move FREE AND OPEN SOURCE section ───────────────────────────────
// A = 0..32780   ends after JUST UPDATED </section>
// B = 96294..100935  \n\n<section download>...</section>\n\n
// C = 32784..96294   <section features>...<section compare/why>...</section>
// NL2  restore separator consumed by DL prefix
// D = 100935..end

const A = c.substring(0, 32780);
const B = c.substring(96294, 100935);
const C = c.substring(32784, 96294);
const D = c.substring(100935);
c = A + B + C + NL2 + D;

console.log('Change 1 length delta:', c.length - original.length, '(expected 0)');
console.log('FREE AND OPEN SOURCE present:', c.includes('FREE AND OPEN SOURCE'));

// Verify join points
const aEnd = A.length;
console.log('A->B join:', JSON.stringify(c.substring(aEnd - 15, aEnd + 15)));
const bEnd = aEnd + B.length;
console.log('B->C join:', JSON.stringify(c.substring(bEnd - 15, bEnd + 15)));
const cEnd = bEnd + C.length;
console.log('C->NL2->D join:', JSON.stringify(c.substring(cEnd - 15, cEnd + 20)));

// ── CHANGE 2: Reroute 4 bare GitHub links to source repo ─────────────────────
// Bare aiden-releases (no /releases path) = GITHUB context links
// aiden-releases/releases/latest = DOWNLOAD links — untouched
// raw.githubusercontent.com/taracodlabs/aiden-releases = backend — untouched

// The bare pattern in the file: aiden-releases\" (backslash + double-quote after)
const BARE = 'github.com/taracodlabs/aiden-releases' + BS + '"';
const SOURCE = 'github.com/taracodlabs/aiden' + BS + '"';

const beforeCount = c.split(BARE).length - 1;
console.log('\nBare aiden-releases occurrences before:', beforeCount);

c = c.split(BARE).join(SOURCE);

const afterCount = c.split(BARE).length - 1;
console.log('Bare aiden-releases occurrences after:', afterCount, '(should be 0)');

// Verify /releases/latest links unchanged
const releasesLatest = c.split('aiden-releases/releases/latest').length - 1;
console.log('aiden-releases/releases/latest (download, unchanged):', releasesLatest);

// Verify raw.githubusercontent links unchanged
const rawLinks = c.split('raw.githubusercontent.com/taracodlabs/aiden-releases').length - 1;
console.log('raw.githubusercontent aiden-releases (backend, unchanged):', rawLinks);

// Count source repo links now
const sourceLinks = c.split('github.com/taracodlabs/aiden' + BS + '"').length - 1;
console.log('Source repo links now:', sourceLinks);

// ── Write ─────────────────────────────────────────────────────────────────────
fs.writeFileSync('C:/Users/shiva/DevOS/cloudflare-worker/landing.js', c, 'utf8');
console.log('\nFile written OK');
