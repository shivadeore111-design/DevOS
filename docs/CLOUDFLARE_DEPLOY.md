# Cloudflare Deploy Procedure

## Which config deploys what

| Config file | Worker name | Domains |
|-------------|-------------|---------|
| `cloudflare-worker/wrangler-landing.toml` | `devos-landing` | `devos.taracod.com/*` (zone route), `aiden.taracod.com` (custom domain) |
| `cloudflare-worker/wrangler.toml` | `devos-license-server` | `api.taracod.com` (custom domain) |

## Deploy commands

```bash
# Landing page (v3.5.0+)
cd cloudflare-worker
wrangler deploy -c wrangler-landing.toml

# License server (Razorpay verification, KV auth)
cd cloudflare-worker
wrangler deploy -c wrangler.toml
# equivalent: wrangler deploy  (wrangler.toml is the default)
```

## ⚠️ WARNING — never run bare `wrangler deploy` from cloudflare-worker/

The default config (`wrangler.toml`) points to the **license server**, not the landing page.
Running `wrangler deploy` without `-c` from `cloudflare-worker/` will deploy the license server.
Always check the dashboard or use explicit `-c` flags.

## Domain conflict recovery (dashboard-first rule)

If a domain ends up on the wrong worker (e.g., `api.taracod.com` appears under `devos-landing`
custom domains even though it's not in `wrangler-landing.toml`), wrangler deploy will prompt:

```
"Update them to point to this script instead? (y/n)"
```

**Answer N and abort.** Then:

1. Go to the **Cloudflare dashboard → Workers & Pages → [wrong worker] → Settings → Domains & Routes**
2. Delete the domain from the wrong worker (trash icon)
3. Wait for confirmation it's gone
4. Re-run `wrangler deploy -c [correct-config].toml`

Deleting first ensures no conflict prompt and no accidental hijacking.

## Why custom_domain vs zone route

- `custom_domain = true` — wrangler auto-creates the DNS record. Use for clean subdomains (`aiden.taracod.com`, `api.taracod.com`).
- `zone_name` pattern — requires the DNS A/CNAME record to already exist in the zone. Use for wildcard paths (`devos.taracod.com/*`). **If DNS is missing, the route will be registered but the domain won't resolve.**

## Account details

- Account: `shiva.deore111@gmail.com`
- Account ID: `459b9952b9ce56c20700080162476543`
- Zone: `taracod.com` (Zone ID: `aedc13a358ae9d606589877be895f571`)

## Fix applied 2026-04-17

**Problem:** `api.taracod.com` was incorrectly attached to `devos-landing` as a manual
custom domain (not in wrangler-landing.toml). `devos-license-server` had no live domains.

**Fix:**
1. Deleted `api.taracod.com` from `devos-landing` manually via Cloudflare dashboard
2. Deployed `devos-license-server` with `wrangler deploy -c wrangler.toml` — claimed `api.taracod.com`
3. Deployed `devos-landing` with `wrangler deploy -c wrangler-landing.toml` — pushed v3.5.0

**Verification:**
- `https://aiden.taracod.com` → landing page, shows v3.5.0 ✓
- `https://api.taracod.com/health` → `{"status":"ok","version":"3.5.0"}` ✓ (license server)
- `https://api.taracod.com/` → `{"error":"Not found"}` ✓ (license server, not landing HTML)
- No `license_key` in landing page response ✓
