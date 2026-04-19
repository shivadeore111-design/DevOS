# Security Policy

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Email **security@taracod.com** with:

- **Affected version** (from `aiden --version` or the About dialog)
- **Reproduction steps** — the minimal sequence of actions to trigger the issue
- **Potential impact** — what an attacker could achieve by exploiting this

You will receive an acknowledgment within **7 business days**. We prefer **coordinated disclosure**: please allow us reasonable time to patch before public disclosure. We will credit researchers in the release notes unless you prefer to remain anonymous.

---

## Supported Versions

Only the **latest minor version** receives security fixes. Older versions are not patched.

| Version | Supported |
|---------|-----------|
| v3.7.x  | ✅ Yes    |
| < v3.7  | ❌ No     |

If you are on an older version, upgrade first to confirm the issue is still present before reporting.

---

## Out of Scope

The following are **not** considered security vulnerabilities in Aiden:

- Vulnerabilities in **third-party dependencies** — please report these directly upstream (npm, GitHub advisories, etc.)
- Issues that require **physical access** to the machine running Aiden
- **Denial of service via resource exhaustion** on the user's own machine (Aiden runs locally with full trust)
- Behaviour that requires the attacker to already have **local admin rights** on the same machine
- Issues in **skills contributed by third parties** (report to the skill author)

---

## Security Design Notes

Aiden runs entirely on your local machine. By default:

- No telemetry is sent without explicit configuration
- API keys are stored in your local `.env` file, never transmitted to Taracod servers
- The dashboard (`localhost:3000`) is bound to loopback only and is not exposed to the network
- Shell execution and browser automation require explicit user commands — Aiden does not run arbitrary code autonomously without a user prompt

If you configure cloud provider API keys (OpenAI, Anthropic, Groq, etc.), requests to those providers are subject to their respective privacy policies.
