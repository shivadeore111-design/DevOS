// contact_functions.js — appended to landing.js by patch_landing5.js
// Functions: contactPage, contactSuccessPage, contactApiHandler, jsonErr, escHtml

// ── Contact page ──────────────────────────────────────────────────────────

function contactPage(url) {
  const t = url.searchParams.get('type') || '';
  const types = [
    ['', 'Select inquiry type\u2026'],
    ['custom-skills', 'Custom Skills'],
    ['sponsored', 'Sponsored Partnership'],
    ['enterprise', 'Self-Hosted Enterprise'],
    ['other', 'Other'],
  ];
  const opts = types.map(([v, l]) =>
    `<option value="${v}"${t === v ? ' selected' : ''}>${l}</option>`
  ).join('');

  const body = `
<style>
.field{margin-bottom:20px}
.field label{display:block;font-family:'JetBrains Mono',monospace;font-size:11px;color:#666;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px}
.opt{color:#444;text-transform:none;letter-spacing:0;font-size:10px}
.field input,.field select,.field textarea{width:100%;background:#111;border:1px solid #222;border-radius:6px;padding:10px 14px;font-family:'Outfit',sans-serif;font-size:14px;color:#e8e8e8;outline:none;transition:border-color .15s;-webkit-appearance:none}
.field input:focus,.field select:focus,.field textarea:focus{border-color:#f97316}
.field select{cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23666' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px}
.field select option{background:#111;color:#e8e8e8}
.field textarea{resize:vertical;min-height:120px;line-height:1.5}
.sub{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:500;background:#f97316;color:#000;border:none;border-radius:6px;padding:12px 28px;cursor:pointer;margin-top:8px;transition:opacity .15s;letter-spacing:.02em}
.sub:hover{opacity:.85}
.sub:disabled{opacity:.5;cursor:not-allowed}
.err{font-family:'JetBrains Mono',monospace;font-size:12px;color:#ef4444;background:#1a0808;border:1px solid #3b1010;border-radius:6px;padding:10px 14px;margin-bottom:16px}
</style>
<h1>Get in touch</h1>
<div class="meta">We respond within 48 hours &middot; <a href="mailto:contact@taracod.com">contact@taracod.com</a></div>
<form id="cf" onsubmit="submitCF(event)" style="margin-top:32px">
  <div class="field">
    <label>Name</label>
    <input type="text" name="name" required placeholder="Your name" autocomplete="name">
  </div>
  <div class="field">
    <label>Email</label>
    <input type="email" name="email" required placeholder="you@company.com" autocomplete="email">
  </div>
  <div class="field">
    <label>Company <span class="opt">(optional)</span></label>
    <input type="text" name="company" placeholder="Acme Corp" autocomplete="organization">
  </div>
  <div class="field">
    <label>Inquiry type</label>
    <select name="type" required>${opts}</select>
  </div>
  <div class="field">
    <label>Message</label>
    <textarea name="message" required minlength="20" rows="6" placeholder="Tell us what you have in mind\u2026"></textarea>
  </div>
  <div class="field">
    <label>How did you hear about Aiden? <span class="opt">(optional)</span></label>
    <input type="text" name="source" placeholder="GitHub, Twitter, a friend\u2026">
  </div>
  <div id="cf-err" class="err" style="display:none"></div>
  <button type="submit" class="sub" id="cf-btn">Send message &#8594;</button>
</form>
<script>
async function submitCF(e) {
  e.preventDefault();
  var btn = document.getElementById('cf-btn');
  var errEl = document.getElementById('cf-err');
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Sending\u2026';
  var fd = new FormData(e.target);
  var data = {};
  fd.forEach(function(v, k) { data[k] = v; });
  try {
    var res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    var json = await res.json();
    if (res.ok && json.success) {
      window.location.href = json.redirect;
    } else {
      throw new Error(json.error || 'Something went wrong. Please try again.');
    }
  } catch(err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Send message \u2192';
  }
}
</script>`;

  return new Response(legalHtml('Contact', body), {
    status: 200, headers: { 'Content-Type': 'text/html;charset=UTF-8' }
  });
}

// ── Contact success page ──────────────────────────────────────────────────

function contactSuccessPage(url) {
  const raw  = url.searchParams.get('name') || '';
  const name = escHtml(raw.slice(0, 80));

  const body = `
<div style="text-align:center;padding:40px 0 32px">
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:20px">
    <circle cx="28" cy="28" r="27" stroke="#f97316" stroke-width="2"/>
    <path d="M17 28l8 8 14-16" stroke="#f97316" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
  <h1 style="font-size:24px;margin-bottom:12px">Message received</h1>
  <p style="font-size:15px;color:#aaa">Thanks${name ? ' ' + name : ''} &mdash; you'll hear back within 48 hours.</p>
</div>
<div style="border-top:1px solid #1a1a1a;margin:8px 0 32px"></div>
<h2>While you wait</h2>
<ul>
  <li><a href="https://github.com/taracodlabs/aiden-releases">Browse releases on GitHub</a></li>
  <li><a href="/#download">Install Aiden</a> &mdash; one command, done in under a minute</li>
  <li><a href="https://discord.gg/gMZ3hUnQTm">Join the Discord</a> &mdash; community support &amp; updates</li>
  <li><a href="/#business">Read about the FOR TEAMS offering</a></li>
  <li><a href="/">Back to homepage</a></li>
</ul>`;

  return new Response(legalHtml('Message received', body), {
    status: 200, headers: { 'Content-Type': 'text/html;charset=UTF-8' }
  });
}

// ── Contact API handler ───────────────────────────────────────────────────

async function contactApiHandler(request, env) {
  try {
    let body;
    try { body = await request.json(); }
    catch(_) { return jsonErr('Invalid JSON body.'); }

    const { name, email, company, type, message, source } = body || {};

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length < 1)
      return jsonErr('Name is required.');
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return jsonErr('A valid email address is required.');
    if (!type || !['custom-skills','sponsored','enterprise','other'].includes(type))
      return jsonErr('Please select an inquiry type.');
    if (!message || typeof message !== 'string' || message.trim().length < 20)
      return jsonErr('Message must be at least 20 characters.');

    const nameClean    = name.trim().slice(0, 120);
    const emailClean   = email.trim().slice(0, 200);
    const companyClean = (company  || '').trim().slice(0, 120);
    const msgClean     = message.trim().slice(0, 5000);
    const sourceClean  = (source   || '').trim().slice(0, 200);

    const typeLabels = {
      'custom-skills': 'Custom Skills',
      'sponsored':     'Sponsored Partnership',
      'enterprise':    'Self-Hosted Enterprise',
      'other':         'Other',
    };
    const typeLabel = typeLabels[type] || type;

    const ts  = new Date().toISOString();
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
                     .map(b => b.toString(16).padStart(2, '0')).join('');
    const kvKey = `contact:${ts.slice(0, 10)}:${hex}`;

    // ── KV backup (best-effort) ──────────────────────────────────────────
    if (env && env.CONTACT_SUBMISSIONS) {
      try {
        await env.CONTACT_SUBMISSIONS.put(kvKey, JSON.stringify({
          name: nameClean, email: emailClean, company: companyClean,
          type, message: msgClean, source: sourceClean,
          ts, ua: request.headers.get('User-Agent') || ''
        }), { expirationTtl: 60 * 60 * 24 * 90 });
      } catch (e) {
        console.warn('KV write failed:', e.message);
      }
    } else {
      console.warn('CONTACT_SUBMISSIONS KV binding not configured — skipping KV backup');
    }

    // ── Send via Resend ──────────────────────────────────────────────────
    if (!env || !env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not set — skipping email delivery');
    } else {
      const RESEND = 'https://api.resend.com/emails';
      const hdr = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + env.RESEND_API_KEY
      };

      const internalHtml =
        '<!DOCTYPE html><html><body style="font-family:monospace;background:#0e0e0e;color:#e8e8e8;padding:24px;max-width:600px">' +
        '<h2 style="color:#f97316;margin:0 0 16px">New contact: ' + escHtml(typeLabel) + '</h2>' +
        '<table style="width:100%;border-collapse:collapse;margin-bottom:24px">' +
        '<tr><td style="color:#888;padding:6px 12px 6px 0;white-space:nowrap;vertical-align:top">Name</td><td style="color:#e8e8e8;padding:6px 0">' + escHtml(nameClean) + '</td></tr>' +
        '<tr><td style="color:#888;padding:6px 12px 6px 0;vertical-align:top">Email</td><td style="padding:6px 0"><a href="mailto:' + escHtml(emailClean) + '" style="color:#f97316">' + escHtml(emailClean) + '</a></td></tr>' +
        '<tr><td style="color:#888;padding:6px 12px 6px 0;vertical-align:top">Company</td><td style="color:#e8e8e8;padding:6px 0">' + (escHtml(companyClean) || '&mdash;') + '</td></tr>' +
        '<tr><td style="color:#888;padding:6px 12px 6px 0;vertical-align:top">Type</td><td style="color:#e8e8e8;padding:6px 0">' + escHtml(typeLabel) + '</td></tr>' +
        '<tr><td style="color:#888;padding:6px 12px 6px 0;vertical-align:top">Source</td><td style="color:#e8e8e8;padding:6px 0">' + (escHtml(sourceClean) || '&mdash;') + '</td></tr>' +
        '<tr><td style="color:#888;padding:6px 12px 6px 0;vertical-align:top">Time</td><td style="color:#aaa;padding:6px 0;font-size:12px">' + ts + '</td></tr>' +
        '<tr><td style="color:#888;padding:6px 12px 6px 0;vertical-align:top">KV key</td><td style="color:#555;padding:6px 0;font-size:11px">' + kvKey + '</td></tr>' +
        '</table>' +
        '<div style="background:#141414;border:1px solid #222;border-radius:6px;padding:16px;margin-bottom:24px">' +
        '<div style="color:#666;font-size:11px;margin-bottom:8px;letter-spacing:.06em;text-transform:uppercase">Message</div>' +
        '<p style="color:#ccc;white-space:pre-wrap;margin:0;font-size:13px;line-height:1.6">' + escHtml(msgClean) + '</p>' +
        '</div>' +
        '<p><a href="mailto:' + escHtml(emailClean) + '" style="color:#f97316">Reply directly &rarr;</a></p>' +
        '</body></html>';

      const autoReplyHtml =
        '<!DOCTYPE html><html><body style="font-family:\'Outfit\',sans-serif;background:#0e0e0e;color:#e8e8e8;padding:24px;max-width:600px;line-height:1.7">' +
        '<h2 style="color:#f97316;margin:0 0 20px">Hey ' + escHtml(nameClean) + ',</h2>' +
        '<p style="color:#aaa">Thanks for reaching out &mdash; your message landed safely. I&rsquo;ll read it personally and get back to you within 48 hours.</p>' +
        '<p style="color:#aaa">If it&rsquo;s urgent, you can reach me directly at <a href="mailto:contact@taracod.com" style="color:#f97316">contact@taracod.com</a>.</p>' +
        '<p style="color:#aaa">In the meantime, feel free to <a href="https://github.com/taracodlabs/aiden-releases" style="color:#f97316">check out Aiden on GitHub</a> or <a href="https://aiden.taracod.com/#download" style="color:#f97316">install it now</a> if you haven&rsquo;t already.</p>' +
        '<p style="color:#555;font-size:12px;margin-top:32px;border-top:1px solid #1a1a1a;padding-top:20px">&mdash; Shiva Deore, Taracod &middot; <a href="https://taracod.com" style="color:#555">taracod.com</a></p>' +
        '</body></html>';

      console.log('Resend internal to: contact@taracod.com, auto-reply to:', emailClean);
      const sends = [
        fetch(RESEND, {
          method: 'POST', headers: hdr,
          body: JSON.stringify({
            from:     'Aiden Contact <contact@taracod.com>',
            to:       ['contact@taracod.com'],
            reply_to: emailClean,
            subject:  '[Aiden] ' + typeLabel + ' \u2014 ' + nameClean,
            html:     internalHtml
          })
        }),
        fetch(RESEND, {
          method: 'POST', headers: hdr,
          body: JSON.stringify({
            from:    'Shiva at Taracod <contact@taracod.com>',
            to:      [emailClean],
            subject: 'Got your message \u2014 Aiden / Taracod',
            html:    autoReplyHtml
          })
        })
      ];

      const results = await Promise.allSettled(sends);
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === 'rejected') {
          console.warn('Resend email', i, 'rejected:', r.reason);
        } else if (r.value && !r.value.ok) {
          const errBody = await r.value.text().catch(() => '');
          console.warn('Resend email', i, 'HTTP error:', r.value.status, errBody.slice(0, 200));
        } else if (r.value && r.value.ok) {
          console.log('Resend email', i, 'sent OK:', r.value.status);
        }
      }
    }

    const redirect = '/contact/success?name=' + encodeURIComponent(nameClean);
    return new Response(JSON.stringify({ success: true, redirect }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('contactApiHandler error:', e);
    return jsonErr('Server error. Please try again or email contact@taracod.com.', 500);
  }
}

function jsonErr(msg, status) {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status: status || 400,
    headers: { 'Content-Type': 'application/json' }
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
