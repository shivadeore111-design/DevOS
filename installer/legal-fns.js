
// ── Legal page helpers ─────────────────────────────────────────

function legalHtml(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} \u2014 Aiden</title>
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
  <a class="bk" href="/">\u2190 Back</a>
</nav>
<div class="w">${body}</div>
<footer>\u00a9 2026 Taracod \u00b7 White Lotus&nbsp;&nbsp;
  <a href="/">Home</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/disclaimer">Disclaimer</a>
  <br><br><a href="mailto:hello@taracod.com">hello@taracod.com</a>
</footer>
</body>
</html>`;
}

function privacyPage() {
  const body = `
<h1>Privacy Policy</h1>
<div class="meta">Effective April 1, 2026 \u00b7 Jurisdiction: India</div>
<div class="box"><p>TL;DR: Aiden runs 100% on your machine. We only store your email to send your download link. Your conversations, files, and data never leave your computer.</p></div>
<h2>What We Collect</h2>
<p>Only your <strong>email address</strong>, used solely to deliver your Aiden download link. We do <strong>not</strong> collect conversations, files, usage data, analytics, or telemetry.</p>
<h2>Where Your Data Lives</h2>
<p>Aiden runs entirely on your local machine. All data stays in <code>workspace/</code> on your computer. Your email is stored in Cloudflare KV only to deliver your download link.</p>
<h2>Third-Party Services</h2>
<p><strong>Resend</strong> \u2014 receives your email to send the download link.</p>
<p><strong>Cloudflare</strong> \u2014 hosts this landing page.</p>
<p><strong>AI API Providers</strong> \u2014 when you configure Groq, Gemini, or OpenRouter in Aiden, prompts go directly from your machine to those providers. Taracod is not a party to those requests:</p>
<ul>
  <li><a href="https://groq.com/privacy-policy/" target="_blank">Groq Privacy Policy</a></li>
  <li><a href="https://policies.google.com/privacy" target="_blank">Google / Gemini Privacy Policy</a></li>
  <li><a href="https://openrouter.ai/privacy" target="_blank">OpenRouter Privacy Policy</a></li>
</ul>
<p>With <strong>Ollama</strong> (local mode), all AI processing stays on your machine.</p>
<h2>Your Rights</h2>
<p>Request deletion of your email: <a href="mailto:hello@taracod.com">hello@taracod.com</a>. We will delete within 7 business days.</p>
<h2>Contact</h2>
<p>Taracod / White Lotus \u00b7 <a href="mailto:hello@taracod.com">hello@taracod.com</a></p>`;
  return new Response(legalHtml("Privacy Policy", body), {
    status: 200, headers: { "Content-Type": "text/html;charset=UTF-8" }
  });
}

function termsPage() {
  const body = `
<h1>Terms of Service</h1>
<div class="meta">Effective April 1, 2026 \u00b7 Governing Law: India</div>
<h2>Acceptance</h2>
<p>By downloading, installing, or using Aiden you agree to these Terms.</p>
<h2>License</h2>
<p>Aiden is licensed for <strong>personal use on up to 2 machines</strong>. You may not redistribute, resell, sublicense, or use Aiden commercially without a Pro license.</p>
<h2>What Aiden Does</h2>
<p>Aiden executes commands, reads/writes files, browses the web, and controls your computer per your instructions. You are responsible for all instructions you give Aiden and for reviewing scheduled tasks and automations.</p>
<h2>AI Providers</h2>
<div class="box"><p>Prompts sent to Groq, Gemini, OpenRouter, and other cloud AI providers go directly from your machine to their servers. Taracod is not responsible for API costs, content generated, availability, or data handling by third-party AI providers.</p></div>
<p>You are responsible for all API costs, compliance with provider terms, and the security of your API keys.</p>
<h2>Disclaimer of Warranties</h2>
<p>Aiden is provided "as is" without warranty. We do not guarantee it will be error-free or uninterrupted.</p>
<h2>Limitation of Liability</h2>
<p>Taracod and White Lotus shall not be liable for indirect, incidental, or consequential damages. Our total liability shall not exceed the amount you paid for Aiden in the preceding 12 months.</p>
<h2>Contact</h2>
<p>Taracod / White Lotus \u00b7 <a href="mailto:hello@taracod.com">hello@taracod.com</a></p>`;
  return new Response(legalHtml("Terms of Service", body), {
    status: 200, headers: { "Content-Type": "text/html;charset=UTF-8" }
  });
}

function disclaimerPage() {
  const body = `
<h1>Disclaimer</h1>
<div class="meta">Effective April 1, 2026</div>
<div class="box"><p>Aiden is a powerful tool. Read this before using it for anything important.</p></div>
<h2>AI Outputs</h2>
<p>AI outputs may be inaccurate, incomplete, or confidently wrong. <strong>Always verify important information before acting.</strong> Do not use Aiden for medical, legal, or financial decisions without consulting a qualified professional.</p>
<h2>Computer Control</h2>
<p>Aiden can execute commands, modify files, and control your computer. Review scheduled tasks regularly. You remain solely responsible for all actions taken on your system. Keep backups of important data.</p>
<h2>API Costs</h2>
<p>API calls to cloud providers go directly from your machine. You are responsible for all usage costs. Aiden has a built-in daily budget cap \u2014 configure it in Settings. Taracod is not responsible for unexpected API bills.</p>
<h2>Data Sent to AI APIs</h2>
<p>When prompts are sent to cloud AI providers, those providers' privacy policies apply. Use Ollama (local mode) for maximum privacy.</p>
<h2>No Warranty</h2>
<p>Aiden is provided without warranty. See our <a href="/terms">Terms of Service</a> for full details.</p>
<h2>Contact</h2>
<p><a href="mailto:hello@taracod.com">hello@taracod.com</a></p>`;
  return new Response(legalHtml("Disclaimer", body), {
    status: 200, headers: { "Content-Type": "text/html;charset=UTF-8" }
  });
}
