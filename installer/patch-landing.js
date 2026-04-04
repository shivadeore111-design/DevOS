// patch-landing.js — run with node to update landing.js
// node installer/patch-landing.js
const fs = require('fs');
const path = require('path');

const landingPath = path.join(__dirname, '..', 'cloudflare-worker', 'landing.js');
let src = fs.readFileSync(landingPath, 'utf-8');

// ── 1. Add consent checkbox before the submit button ─────────
const submitBtn = '\n          <button type=\\"submit\\" class=\\"btnp\\">Get Early Access \\u2192</button>';
const consentBlock = '\n          <div style=\\"display:flex;align-items:flex-start;gap:8px;max-width:440px;margin:0 auto 12px;text-align:left\\"><input type=\\"checkbox\\" id=\\"consent\\" required style=\\"margin-top:2px;accent-color:#f97316\\"><label for=\\"consent\\" style=\\"font-family:var(--mono);font-size:10px;color:var(--muted2);line-height:1.5\\">I agree to the <a href=\\"/terms\\" target=\\"_blank\\" style=\\"color:var(--orange)\\">Terms of Service</a> and <a href=\\"/privacy\\" target=\\"_blank\\" style=\\"color:var(--orange)\\">Privacy Policy</a></label></div>';
if (src.includes(submitBtn)) {
  src = src.replace(submitBtn, consentBlock + submitBtn);
  console.log('✅ Added consent checkbox');
} else {
  console.log('⚠️  Submit button not found with expected string — skipping consent checkbox');
}

// ── 2. Add footer legal links ─────────────────────────────────
const lastFooterLink = '<a class=\\"flink\\" href=\\"#request\\">roadmap</a>';
const withLegalLinks = lastFooterLink +
  '\n        <a class=\\"flink\\" href=\\"/privacy\\">privacy</a>' +
  '\n        <a class=\\"flink\\" href=\\"/terms\\">terms</a>' +
  '\n        <a class=\\"flink\\" href=\\"/disclaimer\\">disclaimer</a>';
if (src.includes(lastFooterLink) && !src.includes('/privacy')) {
  src = src.replace(lastFooterLink, withLegalLinks);
  console.log('✅ Added footer legal links');
} else if (src.includes('/privacy')) {
  console.log('ℹ️  Footer legal links already present');
} else {
  console.log('⚠️  Last footer link not found — skipping footer links');
}

// ── 3. Add URL routing + legal pages before the closing }─────
const oldReturn = `    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Version": "aiden-v2-final"
      }
    })
  }
}`;

const newReturn = `    const url = new URL(request.url);
    const { pathname } = url;
    if (pathname === '/privacy')    return privacyPage();
    if (pathname === '/terms')      return termsPage();
    if (pathname === '/disclaimer') return disclaimerPage();

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Version": "aiden-v2-final"
      }
    })
  }
}

// ── Legal helpers ────────────────────────────────────────────

function legalHtml(title, body) {
  return \`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>\${title} — Aiden</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0e0e0e;color:#e8e8e8;font-family:'Outfit',sans-serif;line-height:1.7}
nav{position:sticky;top:0;background:rgba(14,14,14,.95);backdrop-filter:blur(12px);border-bottom:1px solid #222;padding:0 32px;height:52px;display:flex;align-items:center;justify-content:space-between;z-index:100}
.nl{display:flex;align-items:center;gap:8px;font-family:'JetBrains Mono',monospace;font-size:12px;color:#e8e8e8;text-decoration:none}
.sq{width:24px;height:24px;border-radius:5px;background:#f97316;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#000}
.bk{font-family:'JetBrains Mono',monospace;font-size:11px;color:#666;text-decoration:none}
.bk:hover{color:#e8e8e8}
.w{max-width:720px;margin:0 auto;padding:48px 32px 80px}
h1{font-size:28px;font-weight:700;letter-spacing:-.02em;margin-bottom:8px}
.meta{font-family:'JetBrains Mono',monospace;font-size:11px;color:#555;margin-bottom:40px}
h2{font-size:13px;font-weight:600;color:#f97316;margin:32px 0 10px;text-transform:uppercase;letter-spacing:.07em;font-family:'JetBrains Mono',monospace}
p{color:#aaa;font-size:14px;margin-bottom:12px}
ul{color:#aaa;font-size:14px;margin:0 0 12px 20px}
li{margin-bottom:6px}
a{color:#f97316;text-decoration:none}
a:hover{text-decoration:underline}
.box{background:#141414;border:1px solid #222;border-left:3px solid #f97316;border-radius:8px;padding:14px 18px;margin:16px 0}
.box p{margin:0;font-family:'JetBrains Mono',monospace;font-size:12px;color:#888}
footer{border-top:1px solid #1a1a1a;padding:24px 32px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:10px;color:#444}
footer a{color:#555;margin:0 8px;text-decoration:none}
footer a:hover{color:#888}
</style>
</head>
<body>
<nav>
  <a class="nl" href="/"><div class="sq">A/</div>Aiden</a>
  <a class="bk" href="/">← Back</a>
</nav>
<div class="w">\${body}</div>
<footer>© 2026 Taracod · White Lotus&nbsp;&nbsp;
  <a href="/">Home</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/disclaimer">Disclaimer</a>
  <br><br><a href="mailto:hello@taracod.com">hello@taracod.com</a>
</footer>
</body>
</html>\`;
}

function privacyPage() {
  const body = \`
<h1>Privacy Policy</h1>
<div class="meta">Effective April 1, 2026 · Jurisdiction: India</div>
<div class="box"><p>TL;DR: Aiden runs 100% on your machine. We only store your email to send your download link. Your conversations, files, and data never leave your computer.</p></div>
<h2>What We Collect</h2>
<p>Only your <strong>email address</strong>, used solely to deliver your Aiden download link.</p>
<p>We do <strong>not</strong> collect conversations, files, usage data, analytics, telemetry, or crash reports.</p>
<h2>Where Your Data Lives</h2>
<p>Aiden runs entirely on your local machine. All data stays in <code>workspace/</code> on your computer. Your email is stored in Cloudflare KV only to deliver your download link.</p>
<h2>Third-Party Services</h2>
<p><strong>Resend</strong> — receives your email to send the download link. See resend.com/privacy.</p>
<p><strong>Cloudflare</strong> — hosts this landing page. See cloudflare.com/privacypolicy.</p>
<p><strong>AI API Providers</strong> — when you configure Groq, Gemini, or OpenRouter in Aiden, your prompts go directly from your machine to those providers. Taracod is not a party to those requests:</p>
<ul>
  <li><a href="https://groq.com/privacy-policy/" target="_blank">Groq Privacy Policy</a></li>
  <li><a href="https://policies.google.com/privacy" target="_blank">Google / Gemini Privacy Policy</a></li>
  <li><a href="https://openrouter.ai/privacy" target="_blank">OpenRouter Privacy Policy</a></li>
</ul>
<p>With <strong>Ollama</strong> (local mode), all AI processing stays on your machine.</p>
<h2>Your Rights</h2>
<p>Request deletion of your email: <a href="mailto:hello@taracod.com">hello@taracod.com</a>. We will delete within 7 business days.</p>
<h2>Contact</h2>
<p>Taracod / White Lotus · <a href="mailto:hello@taracod.com">hello@taracod.com</a></p>\`;
  return new Response(legalHtml("Privacy Policy", body), { status: 200, headers: { "Content-Type": "text/html;charset=UTF-8" } });
}

function termsPage() {
  const body = \`
<h1>Terms of Service</h1>
<div class="meta">Effective April 1, 2026 · Governing Law: India</div>
<h2>Acceptance</h2>
<p>By downloading, installing, or using Aiden you agree to these Terms. If you do not agree, do not use Aiden.</p>
<h2>License</h2>
<p>Aiden is licensed for <strong>personal use on up to 2 machines</strong>. You may not redistribute, resell, sublicense, or use Aiden commercially without a Pro license.</p>
<h2>What Aiden Does</h2>
<p>Aiden executes commands, reads/writes files, browses the web, and controls your computer per your instructions. You are responsible for all instructions you give Aiden. Review scheduled tasks and automations regularly.</p>
<h2>AI Providers</h2>
<div class="box"><p>Prompts sent to Groq, Gemini, OpenRouter, and other cloud AI providers go directly from your machine to their servers. Taracod is not responsible for API costs, content generated, availability, or data handling by third-party AI providers.</p></div>
<p>You are responsible for all API costs, compliance with provider terms, and the security of your API keys.</p>
<h2>Disclaimer of Warranties</h2>
<p>Aiden is provided "as is" without warranty. We do not guarantee it will be error-free or uninterrupted.</p>
<h2>Limitation of Liability</h2>
<p>Taracod and White Lotus shall not be liable for indirect, incidental, or consequential damages. Our total liability shall not exceed the amount you paid for Aiden in the preceding 12 months.</p>
<h2>Contact</h2>
<p>Taracod / White Lotus · <a href="mailto:hello@taracod.com">hello@taracod.com</a></p>\`;
  return new Response(legalHtml("Terms of Service", body), { status: 200, headers: { "Content-Type": "text/html;charset=UTF-8" } });
}

function disclaimerPage() {
  const body = \`
<h1>Disclaimer</h1>
<div class="meta">Effective April 1, 2026</div>
<div class="box"><p>Aiden is a powerful tool. Read this before using it for anything important.</p></div>
<h2>AI Outputs</h2>
<p>AI outputs may be inaccurate, incomplete, or confidently wrong. <strong>Always verify important information before acting.</strong> Do not use Aiden for medical, legal, or financial decisions without consulting a qualified professional.</p>
<h2>Computer Control</h2>
<p>Aiden can execute commands, modify files, and control your computer. Review scheduled tasks regularly. You remain solely responsible for all actions taken on your system. Keep backups of important data.</p>
<h2>API Costs</h2>
<p>API calls to cloud providers (Groq, Gemini, OpenRouter) are made directly from your machine. You are responsible for all usage costs. Aiden has a built-in daily budget cap — configure it in Settings. Taracod is not responsible for unexpected API bills.</p>
<h2>Data Sent to AI APIs</h2>
<p>When prompts are sent to cloud AI providers, those providers' privacy policies apply. Taracod has no visibility into data sent to third-party AI APIs. Use Ollama (local mode) for maximum privacy.</p>
<h2>No Warranty</h2>
<p>Aiden is provided without warranty. See our <a href="/terms">Terms of Service</a> for full details.</p>
<h2>Contact</h2>
<p><a href="mailto:hello@taracod.com">hello@taracod.com</a></p>\`;
  return new Response(legalHtml("Disclaimer", body), { status: 200, headers: { "Content-Type": "text/html;charset=UTF-8" } });
}`;

if (src.includes(oldReturn)) {
  src = src.replace(oldReturn, newReturn);
  console.log('✅ Added URL routing and legal pages');
} else {
  console.log('⚠️  Could not find return statement — trying alternate match');
  // Try to append the legal helpers anyway and add routing inline
  const altOld = `    })
  }
}`;
  const altIdx = src.lastIndexOf(altOld);
  if (altIdx > 0) {
    src = src.slice(0, altIdx) + `    const url = new URL(request.url);\n    const { pathname } = url;\n    if (pathname === '/privacy')    return privacyPage();\n    if (pathname === '/terms')      return termsPage();\n    if (pathname === '/disclaimer') return disclaimerPage();\n\n` + src.slice(altIdx);
    console.log('⚠️  Added routing via alternate method');
  }
}

fs.writeFileSync(landingPath, src, 'utf-8');
console.log('✅ Saved landing.js (' + src.length + ' bytes)');
