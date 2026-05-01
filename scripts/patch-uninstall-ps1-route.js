/**
 * Patch: inject uninstallPs1Route() into cloudflare-worker/landing.js
 * Run: node scripts/patch-uninstall-ps1-route.js
 */
'use strict'
const fs   = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', 'cloudflare-worker', 'landing.js')
let c = fs.readFileSync(FILE, 'utf8')

// ── Detect whether the corrupt stub is present ────────────────────────────
const CORRUPT_STUB =
  'function uninstallPs1Route() {\n' +
  '  const script =   return new Response(script, {'

if (!c.includes(CORRUPT_STUB)) {
  console.error('MISS: corrupt stub not found — already patched or changed')
  process.exit(1)
}

// ── Build PS1 content as a plain concatenated string ─────────────────────
// Avoid ${VAR} PowerShell syntax in JS source to prevent any parser confusion.
// Using $VAR form everywhere — equivalent in PowerShell.
const ps1Lines = [
  '# Aiden Windows Uninstaller',
  '# Usage:  irm https://aiden.taracod.com/uninstall.ps1 | iex',
  '# Flags:  -KeepWorkspace  -KeepConfig  -Yes',
  '',
  'param([switch]$KeepWorkspace,[switch]$KeepConfig,[switch]$Yes)',
  '$ErrorActionPreference="SilentlyContinue"',
  '$E=[char]27;$B="$E[1m";$G="$E[32m";$D="$E[2m";$R="$E[0m"',
  '',
  'Write-Host ""',
  'Write-Host ($B+"Aiden - Uninstaller"+$R)',
  'Write-Host ($D+"------------------------------------"+$R)',
  'Write-Host ""',
  '',
  '$removed=0',
  '',
  'function Rm($p,$l){',
  '  if(Test-Path $p){',
  '    Remove-Item -Recurse -Force $p -EA SilentlyContinue',
  '    Write-Host ("  "+$G+"removed"+$R+"  "+$l)',
  '    $script:removed++',
  '  }else{',
  '    Write-Host ("  "+$D+"skipped"+$R+"  "+$l+" "+$D+"(not found)"+$R)',
  '  }',
  '}',
  '',
  'Write-Host "Stopping Aiden server (port 4200)..."',
  '$proc=Get-NetTCPConnection -LocalPort 4200 -State Listen -EA SilentlyContinue|',
  '  Select-Object -First 1 -Expand OwningProcess',
  'if($proc){',
  '  Stop-Process -Id $proc -Force -EA SilentlyContinue',
  '  Write-Host ("  "+$G+"stopped"+$R+"  pid $proc")',
  '}else{',
  '  Write-Host ("  "+$D+"skipped"+$R+"  no process on :4200")',
  '}',
  'Write-Host ""',
  '',
  'if(-not $KeepConfig){',
  '  $appData=if($env:APPDATA){$env:APPDATA}else{Join-Path $env:USERPROFILE "AppData\\Roaming"}',
  '  $local=if($env:LOCALAPPDATA){$env:LOCALAPPDATA}else{Join-Path $env:USERPROFILE "AppData\\Local"}',
  '  Write-Host "Removing Aiden user data..."',
  '  Rm (Join-Path $appData "aiden") "%APPDATA%\\aiden"',
  '  Rm (Join-Path $local "aiden") "%LOCALAPPDATA%\\aiden"',
  '  Write-Host ""',
  '}',
  '',
  'if(-not $KeepWorkspace){',
  '  $ws=Join-Path $env:USERPROFILE ".aiden-workspace"',
  '  if(Test-Path $ws){',
  '    if(-not $Yes){$a=Read-Host "  Delete workspace? [y/N]"}else{$a="y"}',
  '    if($a -match "^[Yy]"){Rm $ws "~/.aiden-workspace"}',
  '    else{Write-Host ("  "+$D+"kept"+$R+"  workspace")}',
  '    Write-Host ""',
  '  }',
  '}',
  '',
  'Write-Host "Checking for npm global install..."',
  '$nl=npm list -g --depth=0 2>$null',
  'if($nl -match "devos-ai|aiden-os|aiden-runtime"){',
  '  $pkg=if($nl -match "aiden-os"){"aiden-os"}',
  '       elseif($nl -match "devos-ai"){"devos-ai"}',
  '       else{"aiden-runtime"}',
  '  npm uninstall -g $pkg 2>$null',
  '  Write-Host ("  "+$G+"removed"+$R+"  npm global: $pkg")',
  '  $removed++',
  '}else{',
  '  Write-Host ("  "+$D+"skipped"+$R+"  no npm global package found")',
  '}',
  'Write-Host ""',
  '',
  'if($removed -gt 0){',
  '  Write-Host ($G+$B+"Done."+$R+" Aiden uninstalled ($removed item(s) removed).")',
  '}else{',
  '  Write-Host ($D+"Nothing to remove."+$R)',
  '}',
  'Write-Host ""',
]

// Build the escaped string literal that goes inside the JS function.
// The PS1 lines will be joined with \n and placed into a JS string.
// We need to escape backslashes and single/double quotes for the JS context.
// Since landing.js uses unescaped JS (not inside a quoted HTML string),
// we can use a template literal. Escape backticks and ${} sequences.
const ps1Content = ps1Lines
  .join('\n')
  .replace(/\\/g, '\\\\')   // escape backslashes first
  .replace(/`/g, '\\`')     // escape backticks (template literal delimiter)
  // PS1 uses ${var} rarely here — we used $var form, so this is a no-op safety
  // but leave it just in case:
  .replace(/\$\{/g, '\\${') // escape ${ to prevent template interpolation

const REAL_FN =
  'function uninstallPs1Route() {\n' +
  '  // Serve the Windows uninstall script.\n' +
  '  // Usage: irm https://aiden.taracod.com/uninstall.ps1 | iex\n' +
  '  const script = `' + ps1Content + '`\n' +
  '  return new Response(script, {'

c = c.replace(CORRUPT_STUB, REAL_FN)

fs.writeFileSync(FILE, c, 'utf8')
console.log('OK: uninstallPs1Route() patched')

// Quick sanity check
const verify = fs.readFileSync(FILE, 'utf8')
const fnIdx = verify.lastIndexOf('function uninstallPs1Route')
const fnSnippet = verify.slice(fnIdx, fnIdx + 120)
console.log('\nSnippet:')
console.log(fnSnippet)
