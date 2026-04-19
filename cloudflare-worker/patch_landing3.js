// patch_landing3.js — wire download buttons to v3.7.0 installer
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'landing.js');
let s = fs.readFileSync(FILE, 'utf8');

const EXE = 'https://github.com/taracodlabs/aiden-releases/releases/download/v3.7.0/Aiden-Setup-3.7.0.exe';

// 1. Free Forever card button: /releases/latest → specific v3.7.0 .exe
const OLD1 = 'aiden-releases/releases/latest';
const NEW1 = 'aiden-releases/releases/download/v3.7.0/Aiden-Setup-3.7.0.exe';
if (!s.includes(OLD1)) { console.error('FAIL: releases/latest not found'); process.exit(1); }
s = s.replace(OLD1, NEW1);
console.log('✓ Free card button → v3.7.0 .exe');

// 2. Nav CTA: href="#download" → href="<exe-url>"  (hero keeps #download for scroll)
// In the file: class=\"ncta\" href=\"#download\"
const OLD2 = 'class=\\"ncta\\" href=\\"#download\\"';
const NEW2 = 'class=\\"ncta\\" href=\\"' + EXE + '\\"';
if (!s.includes(OLD2)) { console.error('FAIL: nav ncta #download not found'); process.exit(1); }
s = s.replace(OLD2, NEW2);
console.log('✓ Nav CTA → v3.7.0 .exe');

fs.writeFileSync(FILE, s);

// Verify
function cnt(str, needle) { let n=0,i=0; while((i=str.indexOf(needle,i))!==-1){n++;i++;} return n; }
const v = fs.readFileSync(FILE, 'utf8');
console.log('\n── Post-patch counts ────────────────');
console.log('Aiden-Setup-3.7:', cnt(v, 'Aiden-Setup-3.7'));
console.log('v3.6.0:         ', cnt(v, 'v3.6.0'));
console.log('v3.7.0:         ', cnt(v, 'v3.7.0'));
console.log('releases/latest:', cnt(v, 'releases/latest'));
console.log('#download ncta: ', cnt(v, 'ncta\\" href=\\"#download'));
