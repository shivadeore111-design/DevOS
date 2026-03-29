const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateLicenseKey() {
  const s = () => Array.from({length:5},()=>CHARS[Math.floor(Math.random()*CHARS.length)]).join("");
  return `${s()}-${s()}-${s()}-${s()}`;
}

function generateToken() {
  const c = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({length:32},()=>c[Math.floor(Math.random()*c.length)]).join("");
}

function json(data, status=200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}

function cors() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}

async function sendEmail(env, to, subject, html) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Aiden <hello@taracod.com>", to: [to], subject, html })
  });
}

async function sendDownloadEmail(env, email, token) {
  const url = `https://api.taracod.com/download/${token}`;
  await sendEmail(env, email, "Welcome to Aiden — Your Download Link", `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:520px;margin:40px auto;color:#e2e8f0;background:#0f172a;padding:32px;border-radius:12px;">
  <h1 style="color:#f97316;margin:0 0 8px;">Welcome to Aiden</h1>
  <p style="color:#94a3b8;margin:0 0 32px;">Your personal AI OS is ready. Click below to download.</p>
  <div style="text-align:center;margin:32px 0;">
    <a href="${url}" style="background:#f97316;color:#000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">Download Aiden</a>
  </div>
  <p style="color:#64748b;font-size:12px;text-align:center;">This link expires in 48 hours.</p>
  <hr style="border:none;border-top:1px solid #334155;margin:24px 0;">
  <p style="color:#64748b;font-size:12px;">Questions? <a href="mailto:hello@taracod.com" style="color:#f97316;">hello@taracod.com</a></p>
</body>
</html>`);
}

async function sendLicenseEmail(env, email, licenseKey, expiryDate) {
  await sendEmail(env, email, "Your Aiden Pro License Key", `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:520px;margin:40px auto;color:#e2e8f0;background:#0f172a;padding:32px;border-radius:12px;">
  <h1 style="color:#f97316;margin:0 0 8px;">Aiden Pro — Activated</h1>
  <p style="color:#94a3b8;margin:0 0 24px;">Your license key is below.</p>
  <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
    <code style="font-size:22px;letter-spacing:4px;color:#f1f5f9;font-weight:700;">${licenseKey}</code>
  </div>
  <p style="color:#94a3b8;font-size:14px;"><strong style="color:#e2e8f0;">Expires:</strong> ${expiryDate}</p>
  <p style="color:#94a3b8;font-size:14px;">Open Aiden ? Settings ? Pro License ? paste your key ? Activate.</p>
  <hr style="border:none;border-top:1px solid #334155;margin:24px 0;">
  <p style="color:#64748b;font-size:12px;">Questions? <a href="mailto:hello@taracod.com" style="color:#f97316;">hello@taracod.com</a></p>
</body>
</html>`);
}

async function handleRegister(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const email = (body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return json({ error: "Valid email required" }, 400);

  const token = generateToken();
  const tokenRecord = { email, token, createdAt: Date.now(), expiresAt: Date.now() + 48*3600*1000 };
  
  const existing = await env.REGISTRATIONS.get(`email:${email}`);
  const emailRecord = existing ? JSON.parse(existing) : { email, registeredAt: Date.now(), machineIds: [] };
  emailRecord.lastToken = token;
  emailRecord.updatedAt = Date.now();

  await env.REGISTRATIONS.put(`token:${token}`, JSON.stringify(tokenRecord), { expirationTtl: 48*3600 });
  await env.REGISTRATIONS.put(`email:${email}`, JSON.stringify(emailRecord));
  await sendDownloadEmail(env, email, token);

  return json({ success: true, message: "Check your email for the download link" });
}

async function handleVerifyInstall(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const email = (body.email || "").trim().toLowerCase();
  const machineId = (body.machineId || "").trim();
  if (!email || !machineId) return json({ allowed: false, reason: "Email and machine ID required" });

  const raw = await env.REGISTRATIONS.get(`email:${email}`);
  if (!raw) return json({ allowed: false, reason: "Email not registered. Get access at devos.taracod.com" });

  const record = JSON.parse(raw);
  if (!record.machineIds) record.machineIds = [];

  if (record.machineIds.includes(machineId)) return json({ allowed: true });

  if (record.machineIds.length < 2) {
    record.machineIds.push(machineId);
    await env.REGISTRATIONS.put(`email:${email}`, JSON.stringify(record));
    return json({ allowed: true });
  }

  return json({ allowed: false, reason: "Active on 2 machines already. Email hello@taracod.com to transfer." });
}

async function handleDownload(request, env) {
  const token = new URL(request.url).pathname.split("/download/")[1];
  if (!token) return json({ error: "Invalid link" }, 400);

  const raw = await env.REGISTRATIONS.get(`token:${token}`);
  const expired = !raw || Date.now() > JSON.parse(raw || "{}").expiresAt;

  if (expired) return new Response(`
<!DOCTYPE html>
<html>
<body style="font-family:system-ui;text-align:center;padding:60px;background:#0f172a;color:#e2e8f0;">
  <h1 style="color:#f97316;">Link Expired</h1>
  <p style="color:#94a3b8;">This download link has expired.</p>
  <a href="https://devos.taracod.com" style="color:#f97316;font-weight:600;">Get a new link ?</a>
</body>
</html>`, { status: 410, headers: { "Content-Type": "text/html" } });

  const record = JSON.parse(raw);
  return new Response(`
<!DOCTYPE html>
<html>
<head><title>Download Aiden</title></head>
<body style="font-family:system-ui;text-align:center;padding:60px;background:#0f172a;color:#e2e8f0;max-width:600px;margin:0 auto;">
  <div style="margin-bottom:32px;">
    <div style="width:60px;height:60px;background:#f97316;border-radius:14px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:28px;">?</div>
    <h1 style="color:#f1f5f9;font-size:28px;margin:0 0 8px;">Download Aiden</h1>
    <p style="color:#94a3b8;">Your personal AI OS. Runs 100% on your machine.</p>
  </div>
  <div style="background:#1e293b;border-radius:12px;padding:24px;margin-bottom:32px;text-align:left;">
    <p style="color:#e2e8f0;font-weight:600;margin:0 0 12px;">Setup (2 minutes):</p>
    <ol style="color:#94a3b8;line-height:2.2;margin:0;padding-left:20px;">
      <li>Download and extract the zip below</li>
      <li>Right-click <code style="color:#f97316;background:#0f172a;padding:2px 6px;border-radius:4px;">install.ps1</code> ? Run with PowerShell</li>
      <li>Double-click <strong style="color:#e2e8f0;">Aiden</strong> on your Desktop</li>
    </ol>
  </div>
  <p style="color:#475569;font-size:13px;margin-bottom:24px;">Requires: Windows 10/11 · Node.js 18+</p>
  <a href="https://github.com/shivadeore111-design/DevOS/releases/download/v2.0.0/Aiden-v2.0.zip"
     style="background:#f97316;color:#000;padding:16px 48px;border-radius:8px;text-decoration:none;font-weight:700;font-size:18px;display:inline-block;">
    Download Aiden
  </a>
  <p style="color:#334155;font-size:11px;margin-top:24px;">Registered to: ${record.email}</p>
  <p style="color:#334155;font-size:11px;">Need help? <a href="mailto:hello@taracod.com" style="color:#f97316;">hello@taracod.com</a></p>
</body>
</html>`, { headers: { "Content-Type": "text/html" } });
}

async function verifyHMAC(secret, body, signature) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2,"0")).join("");
  return hex === signature.replace("sha256=","");
}

async function handleValidate(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ valid: false, error: "Invalid JSON" }, 400); }
  const key = (body.key||"").trim().toUpperCase();
  if (!key || !/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(key)) return json({ valid: false, error: "Invalid key format" }, 400);
  const raw = await env.LICENSES.get(key);
  if (!raw) return json({ valid: false, error: "License not found" }, 404);
  const license = JSON.parse(raw);
  if (!license.active) return json({ valid: false, error: "License deactivated" }, 403);
  if (license.expiry !== 0 && Date.now() > license.expiry) return json({ valid: false, error: "License expired" }, 403);
  return json({ valid: true, tier: license.tier, email: license.email, expiry: license.expiry });
}

async function handleRazorpayWebhook(request, env) {
  const rawBody = await request.text();
  const sig = request.headers.get("x-razorpay-signature") || "";
  if (!await verifyHMAC(env.RAZORPAY_WEBHOOK_SECRET, rawBody, sig)) return json({ error: "Invalid signature" }, 401);
  const event = JSON.parse(rawBody);
  if (event.event !== "payment.captured" && event.event !== "subscription.charged") return json({ received: true });
  const payment = event.payload?.payment?.entity || {};
  const email = payment.email || "";
  if (!email) return json({ error: "No email" }, 400);
  const expiry = Date.now() + 31*24*3600*1000;
  const licenseKey = generateLicenseKey();
  await env.LICENSES.put(licenseKey, JSON.stringify({ email, tier:"pro", createdAt:Date.now(), expiry, orderId:payment.order_id, payment_provider:"razorpay", active:true }));
  await sendLicenseEmail(env, email, licenseKey, new Date(expiry).toDateString());
  return json({ received: true, licenseKey });
}

async function handleAdminCreate(request, env) {
  if (request.headers.get("Authorization") !== `Bearer ${env.ADMIN_SECRET}`) return json({ error: "Unauthorized" }, 401);
  const body = await request.json();
  const email = (body.email||"").trim();
  const days = body.durationDays ?? 365;
  if (!email || !email.includes("@")) return json({ error: "Valid email required" }, 400);
  const expiry = days === 0 ? 0 : Date.now() + days*24*3600*1000;
  const licenseKey = generateLicenseKey();
  await env.LICENSES.put(licenseKey, JSON.stringify({ email, tier:"pro", createdAt:Date.now(), expiry, orderId:`manual_${Date.now()}`, payment_provider:"manual", active:true }));
  if (env.RESEND_API_KEY) await sendLicenseEmail(env, email, licenseKey, expiry === 0 ? "Never" : new Date(expiry).toDateString());
  return json({ success: true, licenseKey, email });
}

export default {
  async fetch(request, env) {
    const { method } = request;
    const { pathname } = new URL(request.url);
    if (method === "OPTIONS") return cors();
    if (method === "GET"  && pathname === "/health")                   return json({ status:"ok", ts:Date.now() });
    if (method === "POST" && pathname === "/register")                 return handleRegister(request, env);
    if (method === "POST" && pathname === "/verify-install")           return handleVerifyInstall(request, env);
    if (method === "GET"  && pathname.startsWith("/download/"))        return handleDownload(request, env);
    if (method === "POST" && pathname === "/validate")                 return handleValidate(request, env);
    if (method === "POST" && pathname === "/webhook/razorpay")         return handleRazorpayWebhook(request, env);
    if (method === "POST" && pathname === "/admin/create")             return handleAdminCreate(request, env);
    return json({ error: "Not found" }, 404);
  }
};
