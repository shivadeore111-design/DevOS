"use strict";
// ============================================================
// devos/product/moduleAssembler.ts
// Generates boilerplate files for each module type
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.moduleAssembler = exports.ModuleAssembler = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// ── Boilerplate templates ──────────────────────────────────
const TEMPLATES = {
    auth: (stack) => ({
        "middleware/auth.js": `// middleware/auth.js — JWT authentication middleware
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'devos-secret-change-in-prod';

function verifyToken(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'No token provided' });

  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { verifyToken, SECRET };
`,
        "routes/auth.js": `// routes/auth.js — Login & register endpoints
const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const { SECRET } = require('../middleware/auth');

// In-memory user store (replace with DB in production)
const users = [];

// POST /auth/register
router.post('/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  if (users.find(u => u.email === email)) return res.status(409).json({ error: 'User already exists' });

  const user = { id: Date.now().toString(), email, password, createdAt: new Date() };
  users.push(user);
  const token = jwt.sign({ id: user.id, email }, SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: { id: user.id, email } });
});

// POST /auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, email }, SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email } });
});

// GET /auth/me  (protected)
const { verifyToken } = require('../middleware/auth');
router.get('/me', verifyToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
`,
    }),
    database: (_stack) => ({
        "db/connection.js": `// db/connection.js — PostgreSQL connection pool
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'devos_app',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max:      10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err.message);
});

async function query(text, params) {
  const start  = Date.now();
  const result = await pool.query(text, params);
  const dur    = Date.now() - start;
  if (process.env.DB_QUERY_LOG === 'true') {
    console.log(\`[DB] \${dur}ms — \${text.slice(0, 80)}\`);
  }
  return result;
}

module.exports = { pool, query };
`,
        "db/schema.sql": `-- db/schema.sql — Initial database schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        VARCHAR(50)  DEFAULT 'user',
  created_at  TIMESTAMP    DEFAULT NOW(),
  updated_at  TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(500) NOT NULL,
  expires_at  TIMESTAMP    NOT NULL,
  created_at  TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  user_id     UUID,
  action      VARCHAR(100) NOT NULL,
  details     JSONB,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email      ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token   ON sessions(token);
`,
    }),
    api: (_stack) => ({
        "routes/api.js": `// routes/api.js — CRUD REST API endpoints
const express = require('express');
const router  = express.Router();
const { verifyToken } = require('../middleware/auth');

// In-memory store (swap with DB query in production)
let items = [];
let nextId = 1;

// GET /api/items — list all
router.get('/items', verifyToken, (req, res) => {
  res.json({ items, total: items.length });
});

// GET /api/items/:id — get one
router.get('/items/:id', verifyToken, (req, res) => {
  const item = items.find(i => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

// POST /api/items — create
router.post('/items', verifyToken, (req, res) => {
  const item = { id: nextId++, ...req.body, createdAt: new Date(), userId: req.user.id };
  items.push(item);
  res.status(201).json(item);
});

// PUT /api/items/:id — update
router.put('/items/:id', verifyToken, (req, res) => {
  const idx = items.findIndex(i => i.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  items[idx] = { ...items[idx], ...req.body, updatedAt: new Date() };
  res.json(items[idx]);
});

// DELETE /api/items/:id — delete
router.delete('/items/:id', verifyToken, (req, res) => {
  const idx = items.findIndex(i => i.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  items.splice(idx, 1);
  res.json({ success: true });
});

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date() });
});

module.exports = router;
`,
        "server.js": `// server.js — Express application entry point
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');

const app  = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request logger
app.use((req, _res, next) => {
  console.log(\`[\${new Date().toISOString()}] \${req.method} \${req.path}\`);
  next();
});

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/api',  require('./routes/api'));

// Root
app.get('/', (_req, res) => {
  res.json({ name: 'DevOS Product API', version: '1.0.0', status: 'running' });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error('[Server] Error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(\`🚀 Server running at http://localhost:\${PORT}\`);
});

module.exports = app;
`,
        "package.json": JSON.stringify({
            name: "devos-product",
            version: "1.0.0",
            main: "server.js",
            scripts: {
                start: "node server.js",
                dev: "nodemon server.js",
            },
            dependencies: {
                express: "^4.18.2",
                cors: "^2.8.5",
                "body-parser": "^1.20.2",
                dotenv: "^16.3.1",
                jsonwebtoken: "^9.0.2",
                pg: "^8.11.3",
            },
        }, null, 2),
        ".env.example": `PORT=3000
JWT_SECRET=change-me-in-production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=devos_app
DB_USER=postgres
DB_PASSWORD=password
DB_QUERY_LOG=false
`,
    }),
    frontend: (_stack) => ({
        "src/index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DevOS App</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; }
    #root { min-height: 100vh; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/App.jsx"></script>
</body>
</html>
`,
        "src/App.jsx": `// src/App.jsx — Main React Application
import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function useAuth() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user,  setUser]  = useState(null);

  useEffect(() => {
    if (!token) return;
    fetch(\`\${API}/auth/me\`, { headers: { Authorization: \`Bearer \${token}\` } })
      .then(r => r.json())
      .then(d => setUser(d.user))
      .catch(() => { setToken(null); localStorage.removeItem('token'); });
  }, [token]);

  const login = async (email, password) => {
    const res  = await fetch(\`\${API}/auth/login\`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return { token, user, login, logout };
}

function LoginForm({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const result = await onLogin(email, password);
    if (result.error) setError(result.error);
  };

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 32, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,.1)' }}>
      <h1 style={{ marginBottom: 24, fontSize: 24 }}>DevOS App</h1>
      {error && <p style={{ color: 'red', marginBottom: 16 }}>{error}</p>}
      <form onSubmit={submit}>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', padding: 10, marginBottom: 12, border: '1px solid #ddd', borderRadius: 4 }} required />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
          style={{ width: '100%', padding: 10, marginBottom: 16, border: '1px solid #ddd', borderRadius: 4 }} required />
        <button type="submit" style={{ width: '100%', padding: 12, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          Sign In
        </button>
      </form>
    </div>
  );
}

function Dashboard({ user, token, onLogout }) {
  const [items, setItems]   = useState([]);
  const [newItem, setNew]   = useState('');

  const headers = { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` };

  useEffect(() => {
    fetch(\`\${API}/api/items\`, { headers })
      .then(r => r.json())
      .then(d => setItems(d.items ?? []));
  }, []);

  const addItem = async () => {
    if (!newItem.trim()) return;
    const res = await fetch(\`\${API}/api/items\`, {
      method: 'POST', headers, body: JSON.stringify({ name: newItem }),
    });
    const item = await res.json();
    setItems(prev => [...prev, item]);
    setNew('');
  };

  const deleteItem = async (id) => {
    await fetch(\`\${API}/api/items/\${id}\`, { method: 'DELETE', headers });
    setItems(prev => prev.filter(i => i.id !== id));
  };

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1>Dashboard</h1>
        <div>
          <span style={{ marginRight: 16 }}>{user?.email}</span>
          <button onClick={onLogout} style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Logout</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input value={newItem} onChange={e => setNew(e.target.value)} placeholder="New item..."
          style={{ flex: 1, padding: 10, border: '1px solid #ddd', borderRadius: 4 }}
          onKeyDown={e => e.key === 'Enter' && addItem()} />
        <button onClick={addItem} style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add</button>
      </div>
      <div>
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, marginBottom: 8, background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,.1)' }}>
            <span>{item.name}</span>
            <button onClick={() => deleteItem(item.id)} style={{ padding: '4px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Delete</button>
          </div>
        ))}
        {!items.length && <p style={{ color: '#888', textAlign: 'center' }}>No items yet. Add one above.</p>}
      </div>
    </div>
  );
}

export default function App() {
  const { token, user, login, logout } = useAuth();
  if (!token) return <LoginForm onLogin={login} />;
  return <Dashboard user={user} token={token} onLogout={logout} />;
}
`,
        "vite.config.js": `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api':  'http://localhost:3000',
      '/auth': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
  },
});
`,
    }),
    billing: (_stack) => ({
        "services/billing.js": `// services/billing.js — Billing integration stub (Stripe / Razorpay)
// Replace with real Stripe SDK calls in production

const PLANS = {
  free:  { id: 'free',  name: 'Free',       price: 0,     features: ['5 items', '1 user'] },
  pro:   { id: 'pro',   name: 'Pro',        price: 999,   features: ['Unlimited items', '10 users', 'Priority support'] },
  team:  { id: 'team',  name: 'Team',       price: 4999,  features: ['Everything in Pro', 'Unlimited users', 'SSO'] },
};

class BillingService {
  constructor() {
    // In production: const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    this.subscriptions = new Map();
  }

  getPlans() {
    return Object.values(PLANS);
  }

  getPlan(planId) {
    return PLANS[planId] ?? null;
  }

  async createSubscription(userId, planId) {
    const plan = this.getPlan(planId);
    if (!plan) throw new Error(\`Unknown plan: \${planId}\`);

    // Stub: in production this would create a Stripe subscription
    const sub = {
      id:        \`sub_\${Date.now()}\`,
      userId,
      planId,
      status:    'active',
      createdAt: new Date(),
      // stripeSubscriptionId: result.id,
    };
    this.subscriptions.set(sub.id, sub);
    console.log(\`[Billing] Created subscription \${sub.id} for user \${userId} (plan: \${planId})\`);
    return sub;
  }

  async cancelSubscription(subId) {
    const sub = this.subscriptions.get(subId);
    if (!sub) throw new Error(\`Subscription not found: \${subId}\`);
    sub.status    = 'cancelled';
    sub.cancelledAt = new Date();
    console.log(\`[Billing] Cancelled subscription \${subId}\`);
    return sub;
  }

  getUserSubscription(userId) {
    for (const sub of this.subscriptions.values()) {
      if (sub.userId === userId && sub.status === 'active') return sub;
    }
    return null;
  }

  // Webhook handler stub
  handleWebhook(event) {
    console.log(\`[Billing] Webhook received: \${event.type}\`);
    // Handle: payment_intent.succeeded, customer.subscription.deleted, invoice.payment_failed
  }
}

module.exports = new BillingService();
`,
        "routes/billing.js": `// routes/billing.js — Billing API endpoints
const express = require('express');
const router  = express.Router();
const billing = require('../services/billing');
const { verifyToken } = require('../middleware/auth');

// GET /billing/plans
router.get('/plans', (_req, res) => {
  res.json({ plans: billing.getPlans() });
});

// POST /billing/subscribe
router.post('/subscribe', verifyToken, async (req, res) => {
  try {
    const { planId } = req.body;
    const sub = await billing.createSubscription(req.user.id, planId);
    res.json({ subscription: sub });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /billing/subscription
router.get('/subscription', verifyToken, (req, res) => {
  const sub = billing.getUserSubscription(req.user.id);
  res.json({ subscription: sub ?? null });
});

// DELETE /billing/subscription/:id
router.delete('/subscription/:id', verifyToken, async (req, res) => {
  try {
    const sub = await billing.cancelSubscription(req.params.id);
    res.json({ subscription: sub });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /billing/webhook  (Stripe/Razorpay webhook endpoint)
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  billing.handleWebhook({ type: req.headers['stripe-event'] ?? 'unknown', body: req.body });
  res.json({ received: true });
});

module.exports = router;
`,
    }),
};
// ── ModuleAssembler ───────────────────────────────────────
class ModuleAssembler {
    async assemble(module, stack, workspacePath) {
        const templateFn = TEMPLATES[module];
        if (!templateFn) {
            return {
                module,
                filesCreated: [],
                success: false,
                error: `No template for module: ${module}`,
            };
        }
        const files = templateFn(stack);
        const created = [];
        for (const [relPath, content] of Object.entries(files)) {
            const absPath = path_1.default.join(workspacePath, relPath);
            const dir = path_1.default.dirname(absPath);
            try {
                fs_1.default.mkdirSync(dir, { recursive: true });
                fs_1.default.writeFileSync(absPath, content, "utf-8");
                created.push(relPath);
                console.log(`[ModuleAssembler] ✅ ${module} → ${relPath}`);
            }
            catch (err) {
                console.warn(`[ModuleAssembler] ⚠️  Failed to write ${relPath}: ${err.message}`);
            }
        }
        return {
            module,
            filesCreated: created,
            success: created.length > 0,
        };
    }
}
exports.ModuleAssembler = ModuleAssembler;
exports.moduleAssembler = new ModuleAssembler();
