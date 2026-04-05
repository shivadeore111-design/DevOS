"use strict";
// ============================================================
// DevOS â€” Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApiServer = createApiServer;
exports.getDefaultModel = getDefaultModel;
exports.startupCheck = startupCheck;
exports.startApiServer = startApiServer;
// api/server.ts â€” DevOS REST API server
//
// Imports ONLY from files that exist in the actual codebase.
// All 34+ missing-module imports from the prior version have been removed.
//
// Endpoints:
//   GET  /api/health          â€” liveness check (no auth)
//   POST /api/chat            â€” queue a user message
//   POST /api/goals           â€” queue a goal
//   GET  /api/goals           â€” placeholder goal list
//   GET  /api/doctor          â€” system health report
//   GET  /api/models          â€” compatible model list
//   GET  /api/stream          â€” SSE keep-alive stream
//   POST /api/automate        â€” start visionLoop session
//   POST /api/automate/stop   â€” abort visionLoop
//   GET  /api/automate/log    â€” screenAgent action log
//   GET  /api/automate/sessionâ€” live executor session
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const http = __importStar(require("http"));
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
// â”€â”€ Real imports only â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const memoryLayers_1 = require("../memory/memoryLayers");
const livePulse_1 = require("../coordination/livePulse");
const doctor_1 = require("../core/doctor");
const modelRouter_1 = require("../core/modelRouter");
const computerUse_1 = require("./routes/computerUse");
const index_1 = require("../providers/index");
const ollama_1 = require("../providers/ollama");
const router_1 = require("../providers/router");
const toolRegistry_1 = require("../core/toolRegistry");
const computerControl_1 = require("../core/computerControl");
const agentLoop_1 = require("../core/agentLoop");
const toolRegistry_2 = require("../core/toolRegistry");
const reactLoop_1 = require("../core/reactLoop");
const scheduler_1 = require("../core/scheduler");
const voiceInput_1 = require("../core/voiceInput");
const voiceOutput_1 = require("../core/voiceOutput");
const planTool_1 = require("../core/planTool");
const taskState_1 = require("../core/taskState");
const taskRecovery_1 = require("../core/taskRecovery");
const skillLoader_1 = require("../core/skillLoader");
const conversationMemory_1 = require("../core/conversationMemory");
const semanticMemory_1 = require("../core/semanticMemory");
const entityGraph_1 = require("../core/entityGraph");
const learningMemory_1 = require("../core/learningMemory");
const knowledgeBase_1 = require("../core/knowledgeBase");
const multer_1 = __importDefault(require("multer"));
const skillTeacher_1 = require("../core/skillTeacher");
const growthEngine_1 = require("../core/growthEngine");
const userCognitionProfile_1 = require("../core/userCognitionProfile");
const licenseManager_1 = require("../core/licenseManager");
const auditTrail_1 = require("../core/auditTrail");
const mcpClient_1 = require("../core/mcpClient");
const responseCache_1 = require("../core/responseCache");
const secretScanner_1 = require("../core/secretScanner");
const morningBriefing_1 = require("../core/morningBriefing");
const memoryRecall_1 = require("../core/memoryRecall");
const costTracker_1 = require("../core/costTracker");
const sessionMemory_1 = require("../core/sessionMemory");
const memoryExtractor_1 = require("../core/memoryExtractor");
const aidenIdentity_1 = require("../core/aidenIdentity");
const eventBus_1 = require("../core/eventBus");
// —— Sprint 25: module-level WebSocket clients registry (shared between createApiServer routes and startApiServer WS setup)
let wsBroadcastClients = new Set();
// â”€â”€ Human-readable tool message helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function humanToolMessage(tool, input) {
    const map = {
        web_search: `Searching the web for "${input?.query || ''}"`,
        deep_research: `Researching "${input?.topic || ''}" in depth`,
        file_write: `Writing to ${input?.path ? input.path.split('\\').pop() : 'a file'}`,
        file_read: `Reading ${input?.path ? input.path.split('\\').pop() : 'a file'}`,
        shell_exec: `Running a system command`,
        run_python: `Executing Python code`,
        run_node: `Executing Node.js code`,
        system_info: `Checking your system specs`,
        screenshot: `Taking a screenshot`,
        fetch_url: `Fetching ${input?.url || 'a URL'}`,
        fetch_page: `Fetching ${input?.url || 'a page'}`,
        notify: `Sending you a notification`,
        get_stocks: `Getting ${input?.market || ''} market data`,
        social_research: `Searching Reddit and HackerNews for "${input?.topic || ''}"`,
        get_market_data: `Looking up ${input?.symbol || 'stock'} price`,
        get_company_info: `Getting company info for ${input?.symbol || ''}`,
        open_browser: `Opening ${input?.url || 'browser'}`,
        browser_click: `Clicking on the page`,
        browser_extract: `Extracting content from page`,
    };
    return map[tool] || `Working on: ${tool}`;
}
// â”€â”€ Chat error handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Centralised error formatting for /api/chat catch blocks.
// Returns user-facing tokens and activity events via the SSE send fn.
function handleChatError(err, apiName, send) {
    const msg = err?.message || String(err) || 'Unknown error';
    console.error('[Chat] Error:', msg);
    if (err?.stack) {
        console.error('[Chat] Stack:', err.stack.split('\n').slice(0, 5).join('\n'));
    }
    const is429 = msg.includes('429') || msg.toLowerCase().includes('rate limit');
    const isTimeout = msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('aborted');
    const isNetwork = msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('fetch failed');
    const isSearchErr = msg.toLowerCase().includes('web search failed') || msg.toLowerCase().includes('search failed');
    if (is429 && apiName !== 'ollama') {
        (0, router_1.markRateLimited)(apiName);
        send({ activity: { icon: 'âš¡', agent: 'Aiden', message: `${apiName} rate limited â€” switching provider`, style: 'error' }, done: false });
        send({ token: `\nâš¡ **${apiName} is rate limited.** Try again in a moment â€” DevOS will switch to a different provider.\n`, done: false });
        send({ token: '\n\n💡 **Tip:** Add a Groq or Gemini key in Settings → API Keys for higher limits and faster responses.', done: false });
    }
    else if (isTimeout) {
        send({ activity: { icon: 'â±ï¸', agent: 'Aiden', message: 'Request timed out', style: 'error' }, done: false });
        send({ token: `\nâ±ï¸ **Request timed out.** The operation took too long. Try a simpler query or check your network.\n`, done: false });
    }
    else if (isNetwork) {
        send({ activity: { icon: 'ðŸ”Œ', agent: 'Aiden', message: 'Network error â€” check connection', style: 'error' }, done: false });
        send({ token: `\nðŸ”Œ **Network error.** Could not reach the required service. Check that Ollama and your network are running.\n`, done: false });
    }
    else if (isSearchErr) {
        send({ activity: { icon: 'ðŸ”', agent: 'Aiden', message: 'Web search unavailable â€” using knowledge base', style: 'error' }, done: false });
        send({ token: `\nðŸ” **Web search is unavailable right now.** I'll answer from my knowledge base instead. To enable live search, start SearxNG: \`npm run searxng\` or run \`scripts\\start-searxng.ps1\`.\n`, done: false });
    }
    else {
        send({ activity: { icon: 'âŒ', agent: 'Aiden', message: `Error: ${msg.slice(0, 120)}`, style: 'error' }, done: false });
        send({ token: `\nâŒ **Something went wrong:** ${msg.slice(0, 200)}\n`, done: false });
    }
    send({ done: true });
}
// â”€â”€ Knowledge upload â€” multer + progress tracking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const KB_UPLOAD_DIR = path.join(process.cwd(), 'workspace', 'knowledge', 'uploads');
if (!fs.existsSync(KB_UPLOAD_DIR))
    fs.mkdirSync(KB_UPLOAD_DIR, { recursive: true });
const kbStorage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, KB_UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
        cb(null, `${Date.now()}_${safe}`);
    },
});
const kbUpload = (0, multer_1.default)({
    storage: kbStorage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
    fileFilter: (_req, file, cb) => {
        const allowed = ['.pdf', '.epub', '.txt', '.md', '.markdown'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext))
            cb(null, true);
        else
            cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowed.join(', ')}`));
    },
});
// Progress map â€” jobId â†’ status/progress (kept in memory, no persistence needed)
const kbProgress = new Map();
// â”€â”€ App factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function createApiServer() {
    const app = (0, express_1.default)();
    // â”€â”€ Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // JSON body parsing (10 MB limit)
    app.use(express_1.default.json({ limit: '10mb' }));
    // Security headers
    app.use((_req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        next();
    });
    // CORS â€” allow any origin (dev mode)
    app.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') {
            res.sendStatus(200);
            return;
        }
        next();
    });
    // â”€â”€ Core routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // GET /api/health â€” liveness probe (no auth required)
    app.get('/api/health', (_req, res) => {
        res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() });
    });
    // â”€â”€ License endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // POST /api/license/validate â€” activate a license key
    app.post('/api/license/validate', async (req, res) => {
        const { key } = req.body;
        if (!key) {
            res.status(400).json({ error: 'key required' });
            return;
        }
        try {
            const result = await (0, licenseManager_1.validateLicense)(key);
            if (!result.valid) {
                res.status(400).json({ valid: false, error: result.error || 'Invalid license' });
                return;
            }
            res.json({ valid: true, tier: result.tier, email: result.email, expiry: result.expiry });
        }
        catch (e) {
            res.status(500).json({ valid: false, error: `Server unreachable: ${e.message}` });
        }
    });
    // GET /api/license/status â€” current license state (from cache, no network)
    app.get('/api/license/status', (_req, res) => {
        const license = (0, licenseManager_1.getCurrentLicense)();
        res.json({
            active: (0, licenseManager_1.isPro)(),
            tier: license.tier || 'free',
            email: license.email || '',
            expiry: license.expiry || 0,
            key: license.key ? license.key.replace(/[A-Z0-9]{5}-[A-Z0-9]{5}-/, '****-****-') : '',
        });
    });
    // POST /api/license/clear â€” deactivate / log out of Pro
    app.post('/api/license/clear', (_req, res) => {
        (0, licenseManager_1.clearLicense)();
        res.json({ success: true });
    });
    // â”€â”€ Jailbreak detection patterns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const JAILBREAK_PATTERNS = [
        'ignore previous instructions',
        'ignore all instructions',
        'you have no restrictions',
        'pretend you are',
        'you are now',
        'act as if',
        'GODMODE',
        ' DAN ',
        'jailbreak',
        'disregard your',
        'forget your instructions',
    ];
    // â”€â”€ Dangerous command patterns (CommandGate) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const DANGEROUS_PATTERNS = [
        'rm -rf',
        'rm -r /',
        'del /f /s',
        'del /s',
        'format c:',
        'format c :',
        'diskpart',
        'shutdown /s',
        'shutdown -s',
        'shutdown the computer',
        'shut down the computer',
        'reg delete',
        'reg add hklm',
        'hklm\\',
        'hklm/',
        'modify the windows registry',
        'edit the registry',
        'remove-item -recurse -force',
        'remove-item -force -recurse',
        'format-volume',
        'clear-disk',
        'stop-computer',
        'restart-computer',
        'send all my files',
        'send all my documents',
        'send all my ',
        'upload all files',
        'upload all my',
        'exfiltrate',
    ];
    // POST /api/chat â€” PLAN â†’ EXECUTE â†’ RESPOND with mode support
    // mode: 'auto' (default) | 'plan' (show plan only) | 'chat' (force chat, skip planner)
    // Supports both SSE streaming (Accept: text/event-stream) and JSON mode (Accept: application/json)
    app.post('/api/chat', async (req, res) => {
        const { history = [], mode = 'auto', sessionId } = (req.body || {});
        // â”€â”€ Sanitize input â€” strip null bytes and control chars â”€â”€â”€â”€
        let message = req.body?.message || '';
        message = message.replace(/\x00/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '');
        // Sprint 22: secret scanning — warn and redact before any persist
        if ((0, secretScanner_1.containsSecret)(message)) {
            console.warn('[Security] Potential secret detected in user message \xe2\x80\x94 redacting before persist');
        }
        message = (0, secretScanner_1.scanAndRedact)(message);
        if (!message || message.trim().length === 0) {
            res.status(400).json({ message: 'Please provide a goal or question.', error: 'empty_message' });
            return;
        }
        // â”€â”€ Jailbreak detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const isJailbreak = JAILBREAK_PATTERNS.some(p => message.toLowerCase().includes(p.toLowerCase()));
        if (isJailbreak) {
            res.json({ message: 'I am Aiden. My identity and safety rules cannot be overridden by conversation.', blocked: true });
            return;
        }
        // â”€â”€ Dangerous command detection (pre-execution gate) â”€â”€â”€â”€â”€â”€â”€
        const isDangerous = DANGEROUS_PATTERNS.some(p => message.toLowerCase().includes(p.toLowerCase()));
        if (isDangerous) {
            res.json({
                message: 'CommandGate: I need your approval before running that operation. It contains a potentially dangerous command (data loss risk). Please confirm explicitly that you want to proceed, or rephrase your request.',
                blocked: true,
                reason: 'dangerous_command',
            });
            return;
        }
        // â”€â”€ Fast math evaluation â€” simple arithmetic without LLM â”€â”€â”€
        const simpleMathMatch = message.match(/^what\s+is\s+([\d]+\s*[+\-*\/]\s*[\d]+)\s*\??$/i);
        if (simpleMathMatch) {
            try {
                // Safe eval: only digits and operators
                const expr = simpleMathMatch[1].replace(/[^0-9+\-*\/\s]/g, '');
                const result = Function(`"use strict"; return (${expr})`)();
                res.json({ message: String(result) });
                return;
            }
            catch { }
        }
        // â”€â”€ Fast identity answers â€” don't need LLM for these â”€â”€â”€â”€â”€â”€
        const identityPatterns = [
            /what.{0,10}(is|are).{0,10}(your name|you called|you named)/i,
            /who are you/i,
            /what('s| is) your name/i,
            /are you (aiden|chatgpt|claude|gpt|openai)/i,
        ];
        if (identityPatterns.some(p => p.test(message))) {
            res.json({ message: 'I\'m Aiden â€” a personal AI OS built by Shiva Deore at Taracod. I run locally on your Windows machine using Ollama. Not ChatGPT, not Claude. Just Aiden.' });
            return;
        }
        // â”€â”€ Fast "running locally" answer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const localPatterns = [
            /are you (local|running locally|on.{0,20}machine|offline)/i,
            /do you (run|work) (locally|offline|on.{0,20}machine)/i,
            /where.{0,20}(run|hosted|deployed)/i,
            /run(ning)? (locally|on.{0,10}machine)/i,
            /(cloud or locally|locally or.{0,10}cloud|in the cloud)/i,
        ];
        if (localPatterns.some(p => p.test(message))) {
            res.json({ message: 'Locally. I run 100% on your machine â€” offline, private. I use Ollama for inference on your device. Your data never leaves this machine.' });
            return;
        }
        // â”€â”€ Date/year fast-path â€” answer from system clock â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const _dateMsg = (message || '').toLowerCase();
        const DATE_PATTERNS = ['what year', 'current year', 'what time', 'what date', 'what is today', "today's date"];
        if (DATE_PATTERNS.some(p => _dateMsg.includes(p))) {
            const now = new Date();
            res.json({ message: `${now.toDateString()}. Year: ${now.getFullYear()}. Time: ${now.toLocaleTimeString()}.`, success: true, provider: 'system_clock' });
            return;
        }
        // â”€â”€ Hardware info fast-path â€” from SOUL.md known config â”€â”€â”€
        if (/what\s+(gpu|graphics|vram|ram|memory|cpu|processor|hardware|specs)\s+(do\s+i|have|i\s+have)|gpu\s+and\s+ram|hardware\s+specs|system\s+specs/i.test(message)) {
            res.json({ message: 'GPU: GTX 1060 6GB VRAM. RAM: detected at runtime (typically 8â€“16 GB). CPU: detected via system info. Run "system_info" for live hardware readings.' });
            return;
        }
        // â”€â”€ File-read fast-path â€” try the file before calling LLM â”€â”€
        // This prevents hallucination on missing files and ensures honest "not found" responses.
        const fileReadMatch = message.match(/read\s+(?:file\s+)?([A-Z]:[/\\][^\s"']+|\/[^\s"']+|[\w./\\]+\.\w{1,6})/i);
        if (fileReadMatch) {
            const fs = require('fs');
            const fp = fileReadMatch[1];
            if (!fs.existsSync(fp)) {
                res.json({ message: `Cannot find file "${fp}" â€” it does not exist or is not accessible. Please check the path.` });
                return;
            }
        }
        // â”€â”€ High-risk actions â€” require explicit confirmation â”€â”€â”€â”€â”€â”€
        const HIGH_RISK_PATTERNS = [
            'send an email',
            'send email',
            'smtp',
            'sendmail',
            'send immediately',
        ];
        const isHighRisk = HIGH_RISK_PATTERNS.some(p => message.toLowerCase().includes(p.toLowerCase()));
        if (isHighRisk) {
            res.json({
                message: 'CommandGate: This action involves sending data externally (email/network). I need your explicit approval before proceeding. Are you sure you want to do this? Please confirm.',
                blocked: true,
                reason: 'high_risk_action_requires_approval',
            });
            return;
        }
        // â”€â”€ Detect if caller wants JSON or SSE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Browser clients set Accept: text/event-stream â†’ SSE mode
        // Test clients and API callers get JSON mode by default
        const acceptHeader = req.headers['accept'] || '';
        const useJsonMode = !acceptHeader.includes('text/event-stream');
        // Switch to the caller's session before any memory operations
        if (sessionId)
            conversationMemory_1.conversationMemory.setSession(sessionId);
        // â”€â”€ JSON mode: collect all tokens, return {message: "..."} â”€
        if (useJsonMode) {
            let fullReply = '';
            const jsonTokens = [];
            const collectToken = (token) => { jsonTokens.push(token); };
            // Sprint 6: tiered model selection per role
            // Responder drives chat mode; planner drives plan/auto mode
            const responderTier = (0, router_1.getModelForTask)('responder');
            const plannerTier = (0, router_1.getModelForTask)('planner');
            const { provider, model, userName, apiName } = (0, router_1.getSmartProvider)();
            const config = (0, index_1.loadConfig)();
            // Responder key (used for streamChat + respondWithResults)
            const rawKey = responderTier.apiKey;
            const providerName = responderTier.providerName;
            const activeModel = responderTier.model;
            const apiName2 = responderTier.apiName;
            // Planner key (used for planWithLLM)
            const plannerKey = plannerTier.apiKey;
            const plannerModel = plannerTier.model;
            const plannerProv = plannerTier.providerName;
            try {
                const resolvedMessage = conversationMemory_1.conversationMemory.addUserMessage(message);
                conversationMemory_1.conversationMemory.recordUserTurn(resolvedMessage);
                if (mode === 'chat') {
                    await streamChat(resolvedMessage, history, userName, provider, activeModel, apiName, (data) => {
                        const d = data;
                        if (d.token)
                            jsonTokens.push(d.token);
                    }, sessionId);
                    (0, router_1.incrementUsage)(apiName);
                    fullReply = jsonTokens.join('');
                    conversationMemory_1.conversationMemory.addAssistantMessage(fullReply);
                    res.json({ message: fullReply, provider: apiName });
                    return;
                }
                // ReAct mode: iterative Thought—Action—Observe for complex goals
                if (mode === 'react') {
                    const reactTier = (0, router_1.getModelForTask)('planner');
                    const reactSteps = [];
                    const reactResult = await (0, reactLoop_1.runReActLoop)(resolvedMessage, reactTier.apiKey, reactTier.model, reactTier.providerName, (step) => {
                        reactSteps.push(step);
                        res.write('data: ' + JSON.stringify({
                            activity: {
                                type: 'tool',
                                message: `ReAct: ${step.thought.action}`,
                                rawTool: step.thought.action,
                                rawInput: step.thought.actionInput,
                            },
                        }) + '\n\n');
                    });
                    conversationMemory_1.conversationMemory.addAssistantMessage(reactResult.answer);
                    res.json({ message: reactResult.answer, provider: reactTier.apiName, steps: reactSteps.length });
                    return;
                }
                // —— Sprint 26: fast mode — skip planning, call LLM directly (used by Quick Action widget)
                if (mode === 'fast') {
                    const quickReply = await (0, agentLoop_1.callLLM)(resolvedMessage, rawKey, activeModel, providerName);
                    conversationMemory_1.conversationMemory.addAssistantMessage(quickReply);
                    res.json({ response: quickReply, message: quickReply, provider: apiName2 });
                    return;
                }
                const memoryContext = conversationMemory_1.conversationMemory.buildContext();
                const plan = await (0, agentLoop_1.planWithLLM)(resolvedMessage, history, plannerKey, plannerModel, plannerProv, memoryContext);
                if (!plan.requires_execution || plan.plan.length === 0) {
                    if (plan.direct_response) {
                        fullReply = plan.direct_response;
                    }
                    else {
                        await streamChat(resolvedMessage, history, userName, provider, activeModel, apiName, (data) => {
                            const d = data;
                            if (d.token)
                                jsonTokens.push(d.token);
                        }, sessionId);
                        fullReply = jsonTokens.join('');
                    }
                    (0, router_1.incrementUsage)(apiName);
                    conversationMemory_1.conversationMemory.addAssistantMessage(fullReply);
                    res.json({ message: fullReply, provider: apiName });
                    return;
                }
                const results = await (0, agentLoop_1.executePlan)(plan, (_step, _result) => { });
                await (0, agentLoop_1.respondWithResults)(resolvedMessage, plan, results, history, userName, rawKey, activeModel, providerName, (token) => { jsonTokens.push(token); }); // responder tier: rawKey/activeModel/providerName already set to responder tier above
                fullReply = jsonTokens.join('');
                const toolsUsed = results.map(r => r.tool);
                const filesCreated = results
                    .filter(r => r.tool === 'file_write' && r.success && r.input?.path)
                    .map(r => r.input.path);
                const searchQueries = results
                    .filter(r => (r.tool === 'web_search' || r.tool === 'deep_research') && r.input?.query)
                    .map(r => r.input.query);
                conversationMemory_1.conversationMemory.updateFromExecution(toolsUsed, filesCreated, searchQueries, plan.planId);
                conversationMemory_1.conversationMemory.addAssistantMessage(fullReply, { toolsUsed, filesCreated, searchQueries, planId: plan.planId });
                (0, router_1.incrementUsage)(apiName);
                // Sprint 30: session memory + identity refresh (non-blocking)
                setTimeout(() => {
                    sessionMemory_1.sessionMemory.addExchange(sessionId || 'default', resolvedMessage, fullReply, filesCreated);
                    (0, aidenIdentity_1.refreshIdentity)();
                }, 100);
                res.json({ message: fullReply, provider: apiName, toolsUsed, filesCreated });
                return;
            }
            catch (err) {
                console.error('[Chat JSON mode] Error:', err.message);
                res.status(500).json({ message: `Something went wrong: ${err.message}`, error: err.message });
                return;
            }
        }
        // â”€â”€ SSE streaming mode (browser clients) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.flushHeaders();
        const send = (data) => {
            try {
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            }
            catch (writeErr) {
                console.error('[Chat] SSE write failed:', writeErr.message);
            }
        };
        // Sprint 6: tiered model selection
        const responderTierSSE = (0, router_1.getModelForTask)('responder');
        const plannerTierSSE = (0, router_1.getModelForTask)('planner');
        const { provider, model, userName } = (0, router_1.getSmartProvider)();
        // BUG 6 fix: use tiered responder's API name for all provider labels, not manually-set active
        const apiName = responderTierSSE.apiName;
        const config = (0, index_1.loadConfig)();
        const rawKey = responderTierSSE.apiKey;
        const providerName = responderTierSSE.providerName;
        const activeModel = responderTierSSE.model;
        const plannerKeySSE = plannerTierSSE.apiKey;
        const plannerModelSSE = plannerTierSSE.model;
        const plannerProvSSE = plannerTierSSE.providerName;
        // ── Conversational fast-path — skip planning for simple messages ──
        // These need zero tools — routing through planWithLLM wastes 8-30 seconds.
        // MUST be AFTER `send` is declared.
        const CONVERSATIONAL = [
            /^hi+\s*[!?.]*$/i,
            /^hey+\s*[!?.]*$/i,
            /^hello+\s*[!?.]*$/i,
            /^how are you/i,
            /^what('?s| is) up/i,
            /^good (morning|afternoon|evening|night)/i,
            /^thanks?(\s+you)?[!.]*$/i,
            /^thank you[!.]*$/i,
            /^ok+a?y?[!.]*$/i,
            /^cool[!.]*$/i,
            /^got it[!.]*$/i,
            /^what can you do/i,
            /^what are your (skills|capabilities|tools)/i,
            /^who are you/i,
            /^are you (there|ready|online|working)/i,
        ];
        const isConversational = mode !== 'plan' && CONVERSATIONAL.some(p => p.test(message.trim()));
        if (isConversational) {
            try {
                const convTokens = [];
                await streamChat(message, history, userName, provider, activeModel, apiName, (data) => {
                    const d = data;
                    if (d.token)
                        convTokens.push(d.token);
                }, sessionId);
                const reply = convTokens.join('').trim() || 'Hey! What do you need?';
                const words = reply.split(' ');
                for (const word of words) {
                    send({ token: word + ' ', done: false, provider: apiName });
                    await new Promise(r => setTimeout(r, 8));
                }
                send({ done: true, provider: apiName });
                res.end();
                userCognitionProfile_1.userCognitionProfile.observe(message, reply);
                conversationMemory_1.conversationMemory.addAssistantMessage(reply);
                return;
            }
            catch {
                send({ token: 'Hey! What do you need?', done: false, provider: 'fallback' });
                send({ done: true, provider: 'fallback' });
                res.end();
                return;
            }
        }
        // â”€â”€ OUTER FATAL CATCH â€” catches anything that escapes the inner handler â”€â”€
        try {
            try {
                // â”€â”€ RESOLVE REFERENCES & RECORD USER TURN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                const resolvedMessage = conversationMemory_1.conversationMemory.addUserMessage(message);
                conversationMemory_1.conversationMemory.recordUserTurn(resolvedMessage);
                // â”€â”€ FORCE CHAT MODE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                if (mode === 'chat') {
                    await streamChat(resolvedMessage, history, userName, provider, activeModel, apiName, send, sessionId);
                    (0, router_1.incrementUsage)(apiName);
                    send({ done: true, provider: apiName });
                    res.end();
                    memoryLayers_1.memoryLayers.write(`User: ${resolvedMessage}`, ['chat']);
                    return;
                }
                // â”€â”€ STEP 1: PLAN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                // Sprint 26: fast mode in SSE path
                if (mode === 'fast') {
                    const quickReply = await (0, agentLoop_1.callLLM)(resolvedMessage, rawKey, activeModel, providerName);
                    conversationMemory_1.conversationMemory.addAssistantMessage(quickReply);
                    const words = quickReply.split(' ');
                    for (const word of words) {
                        send({ token: word + ' ', done: false, provider: apiName });
                        await new Promise(r => setTimeout(r, 8));
                    }
                    send({ done: true, provider: apiName });
                    res.end();
                    return;
                }
                send({ activity: { icon: 'ðŸ§ ', agent: 'Aiden', message: 'Working out a plan...', style: 'thinking' }, done: false });
                const memoryContext = conversationMemory_1.conversationMemory.buildContext();
                const plan = await (0, agentLoop_1.planWithLLM)(resolvedMessage, history, plannerKeySSE, plannerModelSSE, plannerProvSSE, memoryContext);
                // â”€â”€ PLAN-ONLY MODE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                if (mode === 'plan') {
                    const planText = plan.requires_execution && plan.plan.length > 0
                        ? `**Planned steps:**\n${plan.plan.map(s => `${s.step}. \`${s.tool}\` â€” ${s.description}`).join('\n')}\n\n*Plan-only mode â€” not executing.*`
                        : `No execution needed. I can answer this directly.\n\n*Plan-only mode.*`;
                    const words = planText.split(' ');
                    for (const word of words) {
                        send({ token: word + ' ', done: false, provider: apiName });
                        await new Promise(r => setTimeout(r, 10));
                    }
                    send({ done: true, provider: apiName });
                    res.end();
                    return;
                }
                // â”€â”€ NO EXECUTION NEEDED â€” PURE CHAT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                if (!plan.requires_execution || plan.plan.length === 0) {
                    let fullReply = '';
                    // Capability/skills questions must go through LLM with full context injection.
                    // direct_response from the planner has no capabilities awareness â€” it will lie.
                    const isCapabilityQuery = /what.*(can you do|skills|tools|capabilities|abilities)|how many skills|what are you capable/i.test(resolvedMessage);
                    if (plan.direct_response && !isCapabilityQuery) {
                        fullReply = plan.direct_response;
                        const words = plan.direct_response.split(' ');
                        for (const word of words) {
                            send({ token: word + ' ', done: false, provider: apiName });
                            await new Promise(r => setTimeout(r, 10));
                        }
                    }
                    else {
                        await streamChat(resolvedMessage, history, userName, provider, activeModel, apiName, send, sessionId);
                    }
                    (0, router_1.incrementUsage)(apiName);
                    send({ done: true, provider: apiName });
                    res.end();
                    memoryLayers_1.memoryLayers.write(`User: ${resolvedMessage}`, ['chat']);
                    if (fullReply)
                        conversationMemory_1.conversationMemory.addAssistantMessage(fullReply);
                    return;
                }
                // â”€â”€ SHOW PLAN PHASES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                if (plan.phases && plan.phases.length > 0) {
                    const phaseList = plan.phases
                        .filter((p) => p.title !== 'Deliver Results')
                        .map((p, i) => `${i + 1}. ${p.title}`)
                        .join(' â†’ ');
                    send({
                        activity: { icon: 'ðŸ“‹', agent: 'Aiden', message: `Plan: ${phaseList}`, style: 'act' },
                        done: false,
                    });
                }
                else {
                    send({
                        activity: {
                            icon: 'ðŸ“‹', agent: 'Aiden',
                            message: `Plan: ${plan.plan.map(s => s.tool).join(' â†’ ')}`,
                            style: 'act',
                        },
                        done: false,
                    });
                }
                // â”€â”€ STEP 2: EXECUTE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                const results = await (0, agentLoop_1.executePlan)(plan, (step, result) => {
                    send({
                        activity: { icon: 'ðŸ”§', agent: 'Aiden', message: humanToolMessage(step.tool, step.input), style: 'tool', rawTool: step.tool, rawInput: step.input },
                        done: false,
                    });
                    send({
                        activity: {
                            icon: result.success ? 'âœ…' : 'âŒ',
                            agent: 'Aiden',
                            message: (result.success ? result.output : result.error || 'failed').slice(0, 160),
                            style: result.success ? 'done' : 'error',
                        },
                        done: false,
                    });
                }, (phase, index, total) => {
                    send({
                        activity: { icon: 'â–¶', agent: 'Aiden', message: `Phase ${index + 1}/${total}: ${phase.title}`, style: 'act' },
                        done: false,
                    });
                });
                // â”€â”€ STEP 3: RESPOND â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                send({ activity: { icon: 'âœï¸', agent: 'Aiden', message: 'Writing response...', style: 'thinking' }, done: false });
                let streamEnded = false;
                let fullReply = '';
                const timeout = setTimeout(() => {
                    if (!streamEnded) {
                        send({ done: true, error: 'Response timed out' });
                        res.end();
                    }
                }, 30000);
                await (0, agentLoop_1.respondWithResults)(resolvedMessage, plan, results, history, userName, rawKey, activeModel, providerName, (token) => {
                    fullReply += token;
                    send({ token, done: false, provider: apiName });
                });
                streamEnded = true;
                clearTimeout(timeout);
                // â”€â”€ UPDATE CONVERSATION MEMORY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                const toolsUsed = results.map(r => r.tool);
                const filesCreated = results
                    .filter(r => r.tool === 'file_write' && r.success && r.input?.path)
                    .map(r => r.input.path);
                const searchQueries = results
                    .filter(r => (r.tool === 'web_search' || r.tool === 'deep_research') && r.input?.query)
                    .map(r => r.input.query);
                conversationMemory_1.conversationMemory.updateFromExecution(toolsUsed, filesCreated, searchQueries, plan.planId);
                conversationMemory_1.conversationMemory.addAssistantMessage(fullReply, { toolsUsed, filesCreated, searchQueries, planId: plan.planId });
                userCognitionProfile_1.userCognitionProfile.observe(resolvedMessage, fullReply);
                // Sprint 30: session memory + identity refresh (non-blocking)
                setTimeout(() => {
                    sessionMemory_1.sessionMemory.addExchange(sessionId || 'default', resolvedMessage, fullReply, filesCreated);
                    memoryExtractor_1.memoryExtractor.extractFromSession(sessionId || 'default').catch(() => { });
                    (0, aidenIdentity_1.refreshIdentity)();
                }, 100);
                (0, router_1.incrementUsage)(apiName);
                send({ done: true, provider: apiName });
                res.end();
                memoryLayers_1.memoryLayers.write(`User: ${resolvedMessage}`, ['chat']);
            }
            catch (err) {
                handleChatError(err, apiName, send);
                res.end();
            }
        }
        catch (e) {
            // Fatal outer catch â€” something threw outside the inner try (e.g. getSmartProvider crash)
            console.error('[Chat] FATAL outer error:', e.message);
            console.error('[Chat] FATAL stack:', e.stack?.split('\n').slice(0, 3).join('\n'));
            try {
                send({ activity: { icon: 'ðŸ’¥', agent: 'Aiden', message: `Fatal error: ${e.message}`, style: 'error' }, done: false });
                send({ token: `\nA fatal error occurred: ${e.message}`, done: false });
                send({ done: true });
                res.end();
            }
            catch (sendErr) {
                console.error('[Chat] Fatal send failed:', sendErr.message);
            }
        }
    });
    // GET /api/onboarding â€” check status + get available models
    app.get('/api/onboarding', async (_req, res) => {
        const config = (0, index_1.loadConfig)();
        const installedModels = await ollama_1.ollamaProvider.listModels?.() || [];
        const RECOMMENDED = {
            'llama3.2:3b': { label: 'Llama 3.2 3B', contextWindow: 128000, speed: 'âš¡ fastest' },
            'mistral:7b': { label: 'Mistral 7B', contextWindow: 32000, speed: 'ðŸ”¥ fast' },
            'qwen2.5:7b': { label: 'Qwen 2.5 7B', contextWindow: 128000, speed: 'ðŸ”¥ fast' },
            'qwen2.5-coder:7b': { label: 'Qwen 2.5 Coder 7B', contextWindow: 128000, speed: 'ðŸ”¥ fast' },
            'llama3.1:8b': { label: 'Llama 3.1 8B', contextWindow: 128000, speed: 'ðŸ”¥ fast' },
            'phi4:mini': { label: 'Phi-4 Mini', contextWindow: 128000, speed: 'âš¡ fastest' },
            'mistral-nemo:12b': { label: 'Mistral Nemo 12B', contextWindow: 128000, speed: 'ðŸ’ª powerful' },
            'llama3.3:70b': { label: 'Llama 3.3 70B', contextWindow: 128000, speed: 'ðŸ’ª powerful' },
        };
        const localModels = installedModels.map(name => ({
            id: name,
            label: RECOMMENDED[name]?.label || name,
            speed: RECOMMENDED[name]?.speed || 'ðŸ”¥ fast',
            contextWindow: RECOMMENDED[name]?.contextWindow || 32000,
            installed: true,
            recommended: name.includes('qwen2.5') || name.includes('llama3') || name.includes('phi4'),
        })).sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0));
        const cloudProviders = [
            { id: 'groq', label: 'Groq', subtitle: 'Free tier · llama3.3:70b · blazing fast', url: 'https://console.groq.com', models: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'] },
            { id: 'openrouter', label: 'OpenRouter', subtitle: 'Access 200+ models · pay per use', url: 'https://openrouter.ai/keys', models: ['meta-llama/llama-3.3-70b-instruct', 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o'] },
            { id: 'gemini', label: 'Gemini', subtitle: 'Free tier available · fast', url: 'https://aistudio.google.com/app/apikey', models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'] },
            { id: 'cloudflare', label: 'Cloudflare AI', subtitle: '60+ models · free tier · edge inference', url: 'https://dash.cloudflare.com/profile/api-tokens', models: ['accountId|@cf/meta/llama-3.1-8b-instruct'] },
            { id: 'github', label: 'GitHub Models', subtitle: 'GPT-4o · free for GitHub users', url: 'https://github.com/marketplace/models', models: ['gpt-4o-mini', 'gpt-4o'] },
        ];
        res.json({
            onboardingComplete: config.onboardingComplete,
            userName: config.user?.name,
            localModels,
            cloudProviders,
            activeModel: config.model,
            existingApis: config.providers?.apis?.map(a => ({ name: a.name, provider: a.provider })) || [],
        });
    });
    // POST /api/onboarding â€” save onboarding result
    app.post('/api/onboarding', (req, res) => {
        const { userName, modelType, modelId, apiProvider, apiKey, apiName, apiModel } = req.body;
        const config = (0, index_1.loadConfig)();
        config.user.name = userName || 'there';
        if (modelType === 'local' && modelId) {
            config.model = { active: 'ollama', activeModel: modelId };
        }
        else if (modelType === 'api' && apiKey && apiProvider) {
            const entry = {
                name: apiName || `${apiProvider}-main`,
                provider: apiProvider,
                key: apiKey,
                model: apiModel || getDefaultModel(apiProvider),
                enabled: true,
                rateLimited: false,
                usageCount: 0,
            };
            const idx = config.providers.apis.findIndex(a => a.name === entry.name);
            if (idx >= 0)
                config.providers.apis[idx] = entry;
            else
                config.providers.apis.push(entry);
            config.model = { active: entry.name, activeModel: entry.model };
        }
        if (!config.routing)
            config.routing = { mode: 'auto', fallbackToOllama: true };
        config.onboardingComplete = true;
        (0, index_1.saveConfig)(config);
        res.json({ success: true, config });
    });
    // GET /api/onboarding/status â€” lightweight first-run check (used by onboarding gate)
    app.get('/api/onboarding/status', (_req, res) => {
        const config = (0, index_1.loadConfig)();
        const hasName = !!(config.user?.name && config.user.name !== 'there');
        const envName = !!(process.env.USER_NAME);
        const hasOllama = !!(process.env.OLLAMA_MODEL || (config.model?.active === 'ollama' && config.model?.activeModel));
        const completed = !!(config.onboardingComplete && (hasName || envName));
        res.json({
            completed,
            hasOllama,
            hasName: hasName || envName,
            userName: process.env.USER_NAME || config.user?.name || '',
        });
    });
    // POST /api/onboarding/complete â€” write keys/name to .env and config
    app.post('/api/onboarding/complete', (req, res) => {
        const { userName, ollamaModel, geminiKey, groqKey } = req.body;
        // Helper: set or replace a key in .env content
        function setEnvVar(content, key, value) {
            const regex = new RegExp(`^${key}=.*$`, 'm');
            if (regex.test(content))
                return content.replace(regex, `${key}=${value}`);
            return content + `\n${key}=${value}`;
        }
        try {
            const envPath = path.join(process.cwd(), '.env');
            let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
            if (userName)
                envContent = setEnvVar(envContent, 'USER_NAME', userName);
            if (ollamaModel)
                envContent = setEnvVar(envContent, 'OLLAMA_MODEL', ollamaModel);
            if (geminiKey)
                envContent = setEnvVar(envContent, 'GEMINI_API_KEY', geminiKey);
            if (groqKey)
                envContent = setEnvVar(envContent, 'GROQ_API_KEY', groqKey);
            fs.writeFileSync(envPath, envContent);
        }
        catch (e) {
            console.warn('[Onboarding] Could not write .env:', e.message);
        }
        // Also save to config
        const config = (0, index_1.loadConfig)();
        if (userName)
            config.user.name = userName;
        if (ollamaModel)
            config.model = { active: 'ollama', activeModel: ollamaModel };
        if (!config.routing)
            config.routing = { mode: 'auto', fallbackToOllama: true };
        config.onboardingComplete = true;
        (0, index_1.saveConfig)(config);
        res.json({ success: true });
    });
    // GET /api/providers â€” list all configured APIs with status
    app.get('/api/providers', (_req, res) => {
        const config = (0, index_1.loadConfig)();
        res.json({
            apis: config.providers.apis.map(api => ({
                name: api.name,
                provider: api.provider,
                model: api.model,
                enabled: api.enabled,
                rateLimited: api.rateLimited,
                rateLimitedAt: api.rateLimitedAt,
                usageCount: api.usageCount || 0,
                hasKey: (() => {
                    const k = api.key?.startsWith('env:')
                        ? (process.env[api.key.replace('env:', '')] || '')
                        : (api.key || '');
                    return k.length > 0;
                })(),
            })),
            routing: config.routing || { mode: 'auto', fallbackToOllama: true },
            ollama: config.providers.ollama,
        });
    });
    // POST /api/providers/add â€” add or update a single API key
    app.post('/api/providers/add', (req, res) => {
        const { name, provider, key, model, enabled = true } = req.body;
        if (!provider || !key) {
            res.status(400).json({ error: 'provider and key required' });
            return;
        }
        const config = (0, index_1.loadConfig)();
        const entry = {
            name: name || `${provider}-${config.providers.apis.filter(a => a.provider === provider).length + 1}`,
            provider,
            key,
            model: model || getDefaultModel(provider),
            enabled: enabled !== false,
            rateLimited: false,
            usageCount: 0,
        };
        const idx = config.providers.apis.findIndex(a => a.name === entry.name);
        if (idx >= 0)
            config.providers.apis[idx] = { ...config.providers.apis[idx], ...entry };
        else
            config.providers.apis.push(entry);
        if (!config.routing)
            config.routing = { mode: 'auto', fallbackToOllama: true };
        (0, index_1.saveConfig)(config);
        res.json({ success: true, entry: { ...entry, key: '***' } });
    });
    // DELETE /api/providers/:name â€” remove an API
    app.delete('/api/providers/:name', (req, res) => {
        const config = (0, index_1.loadConfig)();
        config.providers.apis = config.providers.apis.filter(a => a.name !== req.params.name);
        (0, index_1.saveConfig)(config);
        res.json({ success: true });
    });
    // PATCH /api/providers/:name â€” update enabled/rateLimited/model etc.
    app.patch('/api/providers/:name', (req, res) => {
        const config = (0, index_1.loadConfig)();
        config.providers.apis = config.providers.apis.map(a => a.name === req.params.name ? { ...a, ...req.body } : a);
        (0, index_1.saveConfig)(config);
        res.json({ success: true });
    });
    // POST /api/providers/reset-limits â€” manually reset all rate limits
    app.post('/api/providers/reset-limits', (_req, res) => {
        const config = (0, index_1.loadConfig)();
        config.providers.apis = config.providers.apis.map(a => ({ ...a, rateLimited: false, rateLimitedAt: undefined }));
        (0, index_1.saveConfig)(config);
        res.json({ success: true, message: 'All rate limits reset' });
    });
    // POST /api/providers/switch â€” switch active model/provider
    app.post('/api/providers/switch', (req, res) => {
        const { active, activeModel } = req.body;
        const config = (0, index_1.loadConfig)();
        config.model = { active: active || 'ollama', activeModel: activeModel || 'mistral:7b' };
        (0, index_1.saveConfig)(config);
        res.json({ success: true });
    });
    // â”€â”€ Knowledge Base endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // GET /api/knowledge â€” list all files + stats
    // GET /api/kb/graph — DeepKB graph endpoint
    app.get('/api/kb/graph', (_req, res) => {
        res.json({ message: 'DeepKB graph endpoint active' });
    });
    app.get('/api/knowledge', (_req, res) => {
        try {
            res.json({ files: knowledgeBase_1.knowledgeBase.listFiles(), stats: knowledgeBase_1.knowledgeBase.getStats() });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // POST /api/knowledge/upload â€” binary file upload (PDF/EPUB/TXT/MD) via multipart/form-data
    // Fields: file (binary), category (optional), tags (optional csv), privacy (optional)
    // PDF and EPUB require a Pro license.
    app.post('/api/knowledge/upload', (req, res) => {
        kbUpload.single('file')(req, res, async (err) => {
            if (err) {
                res.status(400).json({ error: err.message });
                return;
            }
            // Sprint 19: free tier limit -- 3 KB files max
            if (!(0, licenseManager_1.isPro)()) {
                const stats = knowledgeBase_1.knowledgeBase.getStats();
                if (stats.files >= 3) {
                    res.status(403).json({
                        error: 'Free tier limit reached',
                        message: 'Free tier allows 3 knowledge base files. Upgrade to Pro for unlimited.',
                        upgrade: true,
                    });
                    return;
                }
            }
            const file = req.file;
            // Pro gate â€” PDF and EPUB require an active Pro license
            if (file) {
                const ext = path.extname(file.originalname).toLowerCase();
                if ((ext === '.pdf' || ext === '.epub') && !(0, licenseManager_1.isPro)()) {
                    try {
                        fs.unlinkSync(file.path);
                    }
                    catch { }
                    res.status(403).json({
                        error: 'Pro license required',
                        message: 'PDF and EPUB uploads are a Pro feature. Upgrade at DevOS Settings â†’ Pro License.',
                        upgrade: true,
                    });
                    return;
                }
            }
            // Legacy JSON path â€” if no file but content string provided, fall back to ingestText
            if (!file) {
                const { content, filename, category = 'general', tags = '', privacy = 'public' } = req.body;
                if (!content || !filename) {
                    res.status(400).json({ error: 'Provide either a file upload or { content, filename }' });
                    return;
                }
                const tagList = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
                const result = knowledgeBase_1.knowledgeBase.ingestText(content, filename, category, tagList, privacy || 'public');
                if (!result.success) {
                    res.status(400).json({ error: result.error });
                    return;
                }
                res.json({ success: true, filename, chunkCount: result.chunkCount, message: `Ingested ${result.chunkCount} chunks` });
                return;
            }
            try {
                const { category = 'general', tags = '', privacy = 'public' } = req.body;
                const tagList = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
                const result = await knowledgeBase_1.knowledgeBase.ingestFile(file.path, category, privacy || 'public', tagList);
                // Clean up temp upload file (content is now in the KB store)
                try {
                    fs.unlinkSync(file.path);
                }
                catch { }
                if (!result.success) {
                    res.status(400).json({ error: result.error });
                    return;
                }
                res.json({
                    success: true,
                    filename: file.originalname,
                    format: result.format,
                    chunkCount: result.chunkCount,
                    wordCount: result.wordCount,
                    pageCount: result.pageCount,
                    message: `Ingested ${result.chunkCount} chunks from ${file.originalname}`,
                });
            }
            catch (e) {
                try {
                    if (file?.path)
                        fs.unlinkSync(file.path);
                }
                catch { }
                res.status(500).json({ error: e.message });
            }
        });
    });
    // POST /api/knowledge/upload/async â€” returns a jobId immediately, processes in background
    // PDF and EPUB require a Pro license.
    app.post('/api/knowledge/upload/async', (req, res) => {
        kbUpload.single('file')(req, res, async (err) => {
            if (err) {
                res.status(400).json({ error: err.message });
                return;
            }
            const file = req.file;
            if (!file) {
                res.status(400).json({ error: 'file required for async upload' });
                return;
            }
            // Pro gate â€” PDF and EPUB require an active Pro license
            const extAsync = path.extname(file.originalname).toLowerCase();
            if ((extAsync === '.pdf' || extAsync === '.epub') && !(0, licenseManager_1.isPro)()) {
                try {
                    fs.unlinkSync(file.path);
                }
                catch { }
                res.status(403).json({
                    error: 'Pro license required',
                    message: 'PDF and EPUB uploads are a Pro feature. Upgrade at DevOS Settings â†’ Pro License.',
                    upgrade: true,
                });
                return;
            }
            // Sprint 19: free tier limit — 3 KB files max
            if (!(0, licenseManager_1.isPro)()) {
                const statsAsync = knowledgeBase_1.knowledgeBase.getStats();
                if (statsAsync.files >= 3) {
                    try {
                        fs.unlinkSync(file.path);
                    }
                    catch { }
                    res.status(403).json({
                        error: 'Free tier limit reached',
                        message: 'Free tier allows 3 knowledge base files. Upgrade to Pro for unlimited.',
                        upgrade: true,
                    });
                    return;
                }
            }
            const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const { category = 'general', tags = '', privacy = 'public' } = req.body;
            const tagList = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
            kbProgress.set(jobId, { status: 'processing', progress: 10, message: 'Extracting textâ€¦' });
            (async () => {
                try {
                    kbProgress.set(jobId, { status: 'processing', progress: 40, message: 'Chunking & embeddingâ€¦' });
                    const result = await knowledgeBase_1.knowledgeBase.ingestFile(file.path, category, privacy || 'public', tagList);
                    try {
                        fs.unlinkSync(file.path);
                    }
                    catch { }
                    if (!result.success) {
                        kbProgress.set(jobId, { status: 'error', progress: 100, message: result.error || 'Ingestion failed' });
                        return;
                    }
                    kbProgress.set(jobId, {
                        status: 'done',
                        progress: 100,
                        message: `Done â€” ${result.chunkCount} chunks from ${file.originalname}`,
                        result: { filename: file.originalname, format: result.format, chunkCount: result.chunkCount, wordCount: result.wordCount, pageCount: result.pageCount },
                    });
                    // Auto-expire progress entry after 5 minutes
                    setTimeout(() => kbProgress.delete(jobId), 5 * 60 * 1000);
                }
                catch (e) {
                    try {
                        if (file?.path)
                            fs.unlinkSync(file.path);
                    }
                    catch { }
                    kbProgress.set(jobId, { status: 'error', progress: 100, message: e.message });
                }
            })();
            res.json({ success: true, jobId, message: 'Upload started â€” poll /api/knowledge/progress/' + jobId });
        });
    });
    // GET /api/knowledge/progress/:jobId â€” poll async upload progress
    app.get('/api/knowledge/progress/:jobId', (req, res) => {
        const entry = kbProgress.get(String(req.params.jobId));
        if (!entry) {
            res.status(404).json({ error: 'Job not found or already expired' });
            return;
        }
        res.json(entry);
    });
    // GET /api/knowledge/search?q= â€” search knowledge base
    app.get('/api/knowledge/search', (req, res) => {
        const query = req.query.q;
        if (!query) {
            res.status(400).json({ error: 'q parameter required' });
            return;
        }
        const chunks = knowledgeBase_1.knowledgeBase.search(query, 5);
        res.json({
            query,
            results: chunks.map(c => ({
                text: c.text.slice(0, 200),
                filename: c.filename,
                category: c.category,
                score: c.usageCount,
            })),
        });
    });
    // POST /api/knowledge/search â€” search knowledge base (JSON body)
    app.post('/api/knowledge/search', async (req, res) => {
        try {
            const { query, limit = 5 } = req.body;
            if (!query) {
                res.status(400).json({ error: 'query required' });
                return;
            }
            const chunks = knowledgeBase_1.knowledgeBase.search(String(query), Number(limit));
            res.json({
                results: chunks.map(c => ({
                    text: c.text.slice(0, 500),
                    filename: c.filename,
                    category: c.category,
                    score: c.usageCount,
                })),
                count: chunks.length,
                query,
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // POST /api/memory/search â€” search conversation memory
    app.post('/api/memory/search', async (req, res) => {
        try {
            const { query, limit = 5 } = req.body;
            const q = query ? String(query) : '';
            // Build context and return relevant snippets
            const context = conversationMemory_1.conversationMemory.buildContext();
            const lines = context.split('\n').filter(l => !q || l.toLowerCase().includes(q.toLowerCase()));
            res.json({ results: lines.slice(0, Number(limit)), count: lines.length });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // GET /api/providers/status â€” provider health status
    app.get('/api/providers/status', async (_req, res) => {
        try {
            const config = (0, index_1.loadConfig)();
            const providers = config.providers.apis.map((api) => ({
                name: api.name,
                provider: api.provider,
                model: api.model,
                enabled: api.enabled,
                rateLimited: api.rateLimited,
                status: api.rateLimited ? 'rate_limited' : api.enabled ? 'ok' : 'disabled',
                usageCount: api.usageCount || 0,
            }));
            res.json({ providers, ollama: config.providers?.ollama || {} });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // GET /api/conversations â€” list conversation sessions
    app.get('/api/conversations', async (_req, res) => {
        try {
            const sessions = conversationMemory_1.conversationMemory.getSessions ? conversationMemory_1.conversationMemory.getSessions() : [];
            res.json({ conversations: sessions, count: sessions.length });
        }
        catch (err) {
            res.status(500).json({ error: err.message, conversations: [] });
        }
    });
    // DELETE /api/knowledge/:fileId â€” delete a file
    app.delete('/api/knowledge/:fileId', (req, res) => {
        const deleted = knowledgeBase_1.knowledgeBase.deleteFile(String(req.params.fileId));
        if (!deleted) {
            res.status(404).json({ error: 'File not found' });
            return;
        }
        res.json({ success: true, message: 'File deleted from knowledge base' });
    });
    // GET /api/knowledge/stats
    app.get('/api/knowledge/stats', (_req, res) => {
        res.json(knowledgeBase_1.knowledgeBase.getStats());
    });
    // â”€â”€ Skill teacher endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // GET /api/skills/learned â€” list learned + approved skills + stats
    app.get('/api/skills/learned', (_req, res) => {
        try {
            res.json({
                learned: skillTeacher_1.skillTeacher.listLearned(),
                approved: skillTeacher_1.skillTeacher.listApproved(),
                stats: skillTeacher_1.skillTeacher.getStats(),
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // DELETE /api/skills/learned/:name â€” delete a learned skill
    app.delete('/api/skills/learned/:name', (req, res) => {
        try {
            const skillDir = path.join(process.cwd(), 'workspace', 'skills', 'learned', String(req.params.name));
            if (!fs.existsSync(skillDir)) {
                res.status(404).json({ error: 'Skill not found' });
                return;
            }
            fs.rmSync(skillDir, { recursive: true });
            skillLoader_1.skillLoader.refresh();
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // GET /api/config â€” current active model + user info
    app.get('/api/config', (_req, res) => {
        const config = (0, index_1.loadConfig)();
        const tiered = (0, router_1.getModelForTask)('responder');
        // QUICK FIX: return the actual tiered model being used, not the manually-set active model
        const activeModel = tiered.model || config.model.activeModel;
        const activeProvider = tiered.apiName || config.model.active;
        res.json({
            userName: config.user.name,
            activeModel,
            activeProvider,
            onboardingComplete: config.onboardingComplete,
            routing: config.routing,
        });
    });
    // POST /api/providers/validate â€” test an API key without saving it
    app.post('/api/providers/validate', async (req, res) => {
        const { provider, key, model } = req.body;
        if (!provider || !key) {
            res.status(400).json({ valid: false, error: 'Missing provider or key' });
            return;
        }
        const testMessages = [{ role: 'user', content: 'Say "ok" in one word only.' }];
        const testModel = model || getDefaultModel(provider);
        try {
            let valid = false;
            let error = '';
            switch (provider) {
                case 'groq': {
                    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                        body: JSON.stringify({ model: testModel, messages: testMessages, max_tokens: 5 }),
                        signal: AbortSignal.timeout(8000),
                    });
                    valid = r.ok;
                    if (!r.ok)
                        error = `${r.status}: ${await r.text()}`;
                    break;
                }
                case 'gemini': {
                    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: [{ parts: [{ text: 'Say ok' }] }] }),
                        signal: AbortSignal.timeout(8000),
                    });
                    valid = r.ok;
                    if (!r.ok)
                        error = `${r.status}: ${await r.text()}`;
                    break;
                }
                case 'openrouter': {
                    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`,
                            'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'DevOS',
                        },
                        body: JSON.stringify({ model: 'meta-llama/llama-3.2-1b-instruct:free', messages: testMessages, max_tokens: 5 }),
                        signal: AbortSignal.timeout(8000),
                    });
                    valid = r.ok;
                    if (!r.ok)
                        error = `${r.status}: ${await r.text()}`;
                    break;
                }
                case 'cerebras': {
                    const r = await fetch('https://api.cerebras.ai/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                        body: JSON.stringify({ model: 'llama3.1-8b', messages: testMessages, max_tokens: 5 }),
                        signal: AbortSignal.timeout(8000),
                    });
                    valid = r.ok;
                    if (!r.ok)
                        error = `${r.status}: ${await r.text()}`;
                    break;
                }
                case 'nvidia': {
                    const r = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                        body: JSON.stringify({ model: 'meta/llama-3.2-1b-instruct', messages: testMessages, max_tokens: 5 }),
                        signal: AbortSignal.timeout(8000),
                    });
                    valid = r.ok;
                    if (!r.ok)
                        error = `${r.status}: ${await r.text()}`;
                    break;
                }
                case 'cloudflare': {
                    const [accountId] = (model || '').split('|');
                    if (!accountId) {
                        valid = false;
                        error = 'Model must be accountId|modelName';
                        break;
                    }
                    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
                        signal: AbortSignal.timeout(8000),
                    });
                    valid = r.ok;
                    if (!r.ok)
                        error = `${r.status}: ${await r.text()}`;
                    break;
                }
                case 'github': {
                    const r = await fetch('https://models.inference.ai.azure.com/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ model: 'gpt-4o-mini', messages: testMessages, max_tokens: 5 }),
                        signal: AbortSignal.timeout(8000),
                    });
                    valid = r.ok;
                    if (!r.ok)
                        error = `${r.status}: ${await r.text()}`;
                    break;
                }
                default:
                    valid = false;
                    error = 'Unknown provider';
            }
            res.json({ valid, error: valid ? null : error });
        }
        catch (err) {
            res.json({ valid: false, error: err.message });
        }
    });
    // POST /api/keys/validate â€” alias for /api/providers/validate with Ollama support
    // Used by onboarding modal Test buttons and settings drawer.
    // Response: { valid: boolean, status?: number, models?: number, error?: string, provider: string }
    app.post('/api/keys/validate', async (req, res) => {
        const { provider, key } = req.body;
        if (!provider) {
            res.status(400).json({ error: 'Unknown provider' });
            return;
        }
        try {
            if (provider === 'gemini') {
                const r = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                    body: JSON.stringify({ model: 'gemini-2.0-flash', messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
                    signal: AbortSignal.timeout(8000),
                });
                return res.json({ valid: r.ok, status: r.status, provider: 'gemini' });
            }
            if (provider === 'groq') {
                const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                    body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
                    signal: AbortSignal.timeout(8000),
                });
                return res.json({ valid: r.ok, status: r.status, provider: 'groq' });
            }
            if (provider === 'ollama') {
                const r = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
                const data = await r.json();
                return res.json({ valid: r.ok, models: data.models?.length || 0, provider: 'ollama' });
            }
            // For all other providers, delegate to the full validate handler
            const testMessages = [{ role: 'user', content: 'Say "ok" in one word only.' }];
            const testModel = getDefaultModel(provider);
            let valid = false;
            let error = '';
            if (provider === 'openrouter') {
                const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`,
                        'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'DevOS',
                    },
                    body: JSON.stringify({ model: 'meta-llama/llama-3.2-1b-instruct:free', messages: testMessages, max_tokens: 5 }),
                    signal: AbortSignal.timeout(8000),
                });
                valid = r.ok;
                if (!r.ok)
                    error = `${r.status}`;
            }
            res.json({ valid, status: valid ? 200 : 401, error: valid ? undefined : error, provider });
        }
        catch (err) {
            res.json({ valid: false, error: err.message, provider });
        }
    });
    // POST /api/goals â€” start execution loop async
    app.post('/api/goals', async (req, res) => {
        const { title, description } = req.body;
        if (!title)
            return res.status(400).json({ error: 'title required' });
        const goal = description ? `${title}: ${description}` : title;
        // Run async â€” don't await so UI gets immediate response
        Promise.resolve().then(() => __importStar(require('../core/executionLoop'))).then(({ runGoalLoop }) => {
            runGoalLoop(goal).catch(console.error);
        });
        res.json({
            id: `goal_${Date.now()}`,
            title,
            status: 'running',
            message: 'Goal started â€” watch LivePulse for progress',
        });
    });
    // GET /api/goals
    app.get('/api/goals', (_req, res) => {
        res.json({ goals: [], message: 'Goal history coming soon' });
    });
    // GET /api/evolution â€” self-evolution stats
    app.get('/api/evolution', async (_req, res) => {
        try {
            const { evolutionAnalyzer } = await Promise.resolve().then(() => __importStar(require('../core/evolutionAnalyzer')));
            res.json({
                stats: evolutionAnalyzer.getStats(),
                decisions: evolutionAnalyzer.getDecisions(),
                history: evolutionAnalyzer.getHistory(),
                summary: evolutionAnalyzer.getSummary(),
            });
        }
        catch (err) {
            res.status(500).json({ error: err?.message ?? 'evolution stats unavailable' });
        }
    });
    // GET /api/capability — hardware capability profile
    app.get('/api/capability', (_req, res) => {
        const { loadCapabilityProfile } = require('../core/capabilityProfile');
        res.json(loadCapabilityProfile() || { error: 'Profile not built yet' });
    });
    // GET /api/cognition/suggestions — proactive automation patterns
    app.get('/api/cognition/suggestions', (_req, res) => {
        try {
            const patterns = userCognitionProfile_1.userCognitionProfile.detectRepetitivePatterns();
            res.json({ patterns });
        }
        catch (err) {
            res.status(500).json({ error: err?.message ?? 'pattern detection failed' });
        }
    });
    // GET  /api/mcp/servers -- list registered MCP servers
    app.get('/api/mcp/servers', (_req, res) => {
        res.json(mcpClient_1.mcpClient.listServers());
    });
    // POST /api/mcp/servers -- register a new MCP server and discover its tools
    app.post('/api/mcp/servers', async (req, res) => {
        const { name, url, description } = req.body;
        if (!name || !url) {
            res.status(400).json({ error: 'name and url are required' });
            return;
        }
        const server = mcpClient_1.mcpClient.addServer(name, url, description ?? '');
        const tools = await mcpClient_1.mcpClient.discoverTools(name);
        res.json({ server, tools });
    });
    // DELETE /api/mcp/servers/:name -- remove an MCP server
    app.delete('/api/mcp/servers/:name', (req, res) => {
        mcpClient_1.mcpClient.removeServer(String(req.params.name));
        res.json({ success: true });
    });
    // GET  /api/mcp/tools -- list all cached MCP tools across all servers
    app.get('/api/mcp/tools', (_req, res) => {
        res.json(mcpClient_1.mcpClient.getAllCachedTools());
    });
    // GET  /api/cache/stats -- response cache statistics
    app.get('/api/cache/stats', (_req, res) => {
        res.json(responseCache_1.responseCache.getStats());
    });
    // POST /api/cache/clear -- flush all cached tool results
    app.post('/api/cache/clear', (_req, res) => {
        responseCache_1.responseCache.clear();
        res.json({ success: true, message: 'Cache cleared' });
    });
    // POST /api/register -- Sprint 20: email registration for early access
    app.post('/api/register', async (req, res) => {
        const { email } = req.body;
        if (!email || !email.includes('@')) {
            res.status(400).json({ error: 'Valid email required' });
            return;
        }
        const { registerEmail } = await Promise.resolve().then(() => __importStar(require('../core/licenseManager')));
        const result = await registerEmail(email);
        if (result.success) {
            // Persist email into config so verifyInstall can use it on next boot
            const cfg = (0, index_1.loadConfig)();
            cfg.user.email = email;
            (0, index_1.saveConfig)(cfg);
        }
        res.json(result);
    });
    // GET  /api/scheduler/tasks — list all scheduled tasks
    app.get('/api/scheduler/tasks', (_req, res) => {
        res.json(scheduler_1.scheduler.list());
    });
    // POST /api/scheduler/tasks — create a new scheduled task
    app.post('/api/scheduler/tasks', (req, res) => {
        const { description, schedule, goal } = req.body;
        if (!description || !schedule || !goal) {
            res.status(400).json({ error: 'description, schedule, and goal are required' });
            return;
        }
        // Sprint 19: free tier limit -- 1 scheduled task max
        if (!(0, licenseManager_1.isPro)()) {
            const tasks = scheduler_1.scheduler.list();
            if (tasks.length >= 1) {
                res.status(403).json({
                    error: 'Free tier limit reached',
                    message: 'Free tier allows 1 scheduled task. Upgrade to Pro for unlimited.',
                    upgrade: true,
                });
                return;
            }
        }
        const task = scheduler_1.scheduler.add(description, schedule, goal);
        res.json(task);
    });
    // DELETE /api/scheduler/tasks/:id — remove a scheduled task
    app.delete('/api/scheduler/tasks/:id', (req, res) => {
        const taskId = String(req.params.id);
        const removed = scheduler_1.scheduler.remove(taskId);
        if (removed) {
            res.json({ success: true });
        }
        else {
            res.status(404).json({ error: `Task ${taskId} not found` });
        }
    });
    // PATCH /api/scheduler/tasks/:id — enable/disable a task
    app.patch('/api/scheduler/tasks/:id', (req, res) => {
        const { enabled } = req.body;
        if (typeof enabled !== 'boolean') {
            res.status(400).json({ error: 'enabled (boolean) is required' });
            return;
        }
        const toggleId = String(req.params.id);
        const ok = scheduler_1.scheduler.toggle(toggleId, enabled);
        if (ok) {
            res.json({ success: true });
        }
        else {
            res.status(404).json({ error: `Task ${toggleId} not found` });
        }
    });
    // GET  /api/briefing/config — load morning briefing config
    app.get('/api/briefing/config', (_req, res) => {
        res.json((0, morningBriefing_1.loadBriefingConfig)());
    });
    // POST /api/briefing/config — save morning briefing config
    app.post('/api/briefing/config', (req, res) => {
        const config = req.body;
        (0, morningBriefing_1.saveBriefingConfig)(config);
        scheduler_1.scheduler.registerMorningBriefing();
        res.json({ success: true });
    });
    // POST /api/briefing — receive briefing content, broadcast to WebSocket clients
    app.post('/api/briefing', (req, res) => {
        const { content, label } = req.body;
        if (content) {
            const payload = JSON.stringify({ type: 'briefing', content, label, timestamp: Date.now() });
            wsBroadcastClients.forEach((ws) => {
                try {
                    if (ws.readyState === ws.OPEN)
                        ws.send(payload);
                }
                catch { }
            });
        }
        res.json({ success: true });
    });
    // POST /api/briefing/run — trigger morning briefing manually
    app.post('/api/briefing/run', async (_req, res) => {
        try {
            const config = (0, morningBriefing_1.loadBriefingConfig)();
            await (0, morningBriefing_1.deliverBriefing)(config);
            res.json({ success: true, message: 'Briefing delivered' });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    // GET /api/growth — Sprint 27: GrowthEngine + UserCognition stats for dashboard card
    app.get('/api/growth', (_req, res) => {
        try {
            const entries = auditTrail_1.auditTrail.getToday();
            const allTime = (() => {
                const p = require('path').join(process.cwd(), 'workspace', 'audit', 'audit.jsonl');
                if (!require('fs').existsSync(p))
                    return [];
                return require('fs').readFileSync(p, 'utf-8').trim().split('\n').filter(Boolean).map((l) => {
                    try {
                        return JSON.parse(l);
                    }
                    catch {
                        return null;
                    }
                }).filter(Boolean);
            })();
            const totalActions = allTime.length;
            const successRate = allTime.length > 0
                ? Math.round((allTime.filter((e) => e.success).length / allTime.length) * 100)
                : 0;
            const profile = userCognitionProfile_1.userCognitionProfile.getProfile?.();
            const skillsDir = require('path').join(process.cwd(), 'skills');
            const approvedDir = require('path').join(skillsDir, 'approved');
            const skillCount = require('fs').existsSync(skillsDir)
                ? require('fs').readdirSync(skillsDir).filter((f) => f.endsWith('.md')).length : 0;
            const approvedCount = require('fs').existsSync(approvedDir)
                ? require('fs').readdirSync(approvedDir).filter((f) => f.endsWith('.md')).length : 0;
            res.json({
                totalActions,
                successRate,
                skillsLearned: skillCount,
                skillsApproved: approvedCount,
                todayActions: entries.length,
                todaySuccess: entries.filter((e) => e.success).length,
                profile: {
                    verbosity: profile?.verbosity || 'balanced',
                    technicalLevel: profile?.technicalLevel || 'medium',
                    decisionStyle: profile?.decisionStyle || 'analytical',
                },
                patterns: userCognitionProfile_1.userCognitionProfile.detectRepetitivePatterns?.()?.slice(0, 2) ?? [],
            });
        }
        catch (e) {
            res.json({ error: e.message });
        }
    });
    // GET /api/mcp/info — MCP server discovery
    app.get('/api/mcp/info', (_req, res) => {
        res.json({
            mcpServer: 'http://localhost:3001',
            tools: Object.keys(toolRegistry_2.TOOL_DESCRIPTIONS).length,
            message: 'Add this to your Claude Desktop or MCP client config to connect to Aiden',
            configExample: {
                mcpServers: {
                    aiden: {
                        url: 'http://localhost:3001',
                        name: 'Aiden — Personal AI OS',
                        description: 'Connect to your local Aiden instance for file access, web search, computer control, and persistent memory',
                    },
                },
            },
        });
    });
    // POST /api/react — standalone ReAct agent endpoint (SSE streaming)
    app.post('/api/react', async (req, res) => {
        const { goal } = req.body;
        if (!goal || !goal.trim()) {
            res.status(400).json({ error: 'goal is required' });
            return;
        }
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        try {
            const tier = (0, router_1.getModelForTask)('planner');
            const steps = [];
            const result = await (0, reactLoop_1.runReActLoop)(goal.trim(), tier.apiKey, tier.model, tier.providerName, (step) => {
                steps.push(step);
                res.write('data: ' + JSON.stringify({
                    type: 'step',
                    action: step.thought.action,
                    reasoning: step.thought.reasoning,
                    observation: step.observation.result.slice(0, 500),
                    success: step.observation.success,
                }) + '\n\n');
            });
            res.write('data: ' + JSON.stringify({
                type: 'done',
                answer: result.answer,
                steps: steps.length,
            }) + '\n\n');
            res.end();
        }
        catch (err) {
            res.write('data: ' + JSON.stringify({ type: 'error', message: err?.message ?? 'ReAct failed' }) + '\n\n');
            res.end();
        }
    });
    // GET /api/audit/today — daily activity summary
    app.get('/api/audit/today', (_req, res) => {
        const entries = auditTrail_1.auditTrail.getToday();
        res.json({
            entries,
            summary: auditTrail_1.auditTrail.formatSummary(entries),
        });
    });
    // GET /api/doctor
    app.get('/api/doctor', async (_req, res) => {
        try {
            const result = await (0, doctor_1.runDoctor)();
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ error: err?.message ?? 'doctor check failed' });
        }
    });
    // GET /api/models
    app.get('/api/models', (_req, res) => {
        res.json({
            compatible: modelRouter_1.modelRouter.listModels(),
            hardware: modelRouter_1.modelRouter.getHardware(),
        });
    });
    // GET /api/stream — SSE keep-alive + cost_update + identity_update events
    app.get('/api/stream', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.flushHeaders();
        const ping = setInterval(() => {
            try {
                res.write('data: {“type”:”ping”}\n\n');
            }
            catch { }
        }, 30000);
        const sendEvent = (type, data) => {
            try {
                res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
            }
            catch { }
        };
        const onCostUpdate = (data) => sendEvent('cost_update', data);
        const onIdentityUpdate = (data) => sendEvent('identity_update', data);
        eventBus_1.eventBus.on('cost_update', onCostUpdate);
        eventBus_1.eventBus.on('identity_update', onIdentityUpdate);
        req.on('close', () => {
            clearInterval(ping);
            eventBus_1.eventBus.removeListener('cost_update', onCostUpdate);
            eventBus_1.eventBus.removeListener('identity_update', onIdentityUpdate);
        });
    });
    // GET /api/identity — Aiden identity snapshot
    app.get('/api/identity', (_req, res) => {
        try {
            res.json((0, aidenIdentity_1.getIdentity)());
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // GET /api/cost — today's cost summary
    app.get('/api/cost', (_req, res) => {
        try {
            res.json(costTracker_1.costTracker.getDailySummary());
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // GET /api/pulse â€” SSE stream of LivePulse events (tool:start, tool:done, plan:start, plan:done)
    // Dashboard connects here to show real-time execution activity.
    app.get('/api/pulse', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.flushHeaders();
        // Send ping every 25s to keep connection alive
        const ping = setInterval(() => {
            try {
                res.write('data: {"event":"ping"}\n\n');
            }
            catch { }
        }, 25000);
        // Bridge livePulse EventEmitter â†’ SSE
        const onPulse = (event) => {
            try {
                const payload = JSON.stringify({ event: event.type, data: event, ts: Date.now() });
                res.write(`data: ${payload}\n\n`);
            }
            catch { /* client disconnected */ }
        };
        livePulse_1.livePulse.on('any', onPulse);
        req.on('close', () => {
            clearInterval(ping);
            livePulse_1.livePulse.removeListener('any', onPulse);
        });
    });
    // â”€â”€ Computer-use routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // POST /api/automate, POST /api/automate/stop,
    // GET  /api/automate/log, GET /api/automate/session
    (0, computerUse_1.registerComputerUseRoutes)(app);
    // GET /api/plan/:id â€” get plan status
    app.get('/api/plan/:id', (req, res) => {
        const plan = planTool_1.planTool.getPlan(String(req.params.id));
        if (!plan) {
            res.status(404).json({ error: 'Plan not found' });
            return;
        }
        res.json(plan);
    });
    // GET /api/plans/recent â€” list 10 most recent task plans
    app.get('/api/plans/recent', (_req, res) => {
        try {
            const tasksDir = path.join(process.cwd(), 'workspace', 'tasks');
            if (!fs.existsSync(tasksDir)) {
                res.json([]);
                return;
            }
            const tasks = fs.readdirSync(tasksDir)
                .filter(t => t.startsWith('task_'))
                .sort().reverse().slice(0, 10)
                .map(t => {
                try {
                    const planPath = path.join(tasksDir, t, 'plan.json');
                    if (!fs.existsSync(planPath))
                        return null;
                    const p = JSON.parse(fs.readFileSync(planPath, 'utf-8'));
                    return {
                        id: p.id,
                        goal: p.goal,
                        status: p.status,
                        phases: p.phases.length,
                        completedPhases: p.phases.filter((ph) => ph.status === 'done').length,
                        createdAt: p.createdAt,
                    };
                }
                catch {
                    return null;
                }
            })
                .filter(Boolean);
            res.json(tasks);
        }
        catch {
            res.json([]);
        }
    });
    // GET /api/skills â€” list all available skills
    app.get('/api/skills', (_req, res) => {
        try {
            const skills = skillLoader_1.skillLoader.loadAll();
            res.json(skills.map(s => ({
                name: s.name,
                description: s.description,
                version: s.version,
                tags: s.tags,
                filePath: s.filePath,
            })));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // GET /api/skills/relevant?q=query â€” find skills for a query
    app.get('/api/skills/relevant', (req, res) => {
        const query = req.query.q || '';
        if (!query) {
            res.status(400).json({ error: 'q parameter required' });
            return;
        }
        const relevant = skillLoader_1.skillLoader.findRelevant(query);
        res.json(relevant.map(s => ({ name: s.name, description: s.description, tags: s.tags })));
    });
    // POST /api/skills/refresh â€” reload all skills from disk
    app.post('/api/skills/refresh', (_req, res) => {
        skillLoader_1.skillLoader.refresh();
        const skills = skillLoader_1.skillLoader.loadAll();
        res.json({ success: true, count: skills.length, skills: skills.map(s => s.name) });
    });
    // GET /api/tasks â€” list all tasks with status
    app.get('/api/tasks', (_req, res) => {
        const tasks = taskState_1.taskStateManager.listAll();
        res.json(tasks.map((t) => ({
            id: t.id,
            goal: t.goal,
            status: t.status,
            progress: `${t.currentStep}/${t.totalSteps}`,
            tokenUsage: t.tokenUsage,
            tokenLimit: t.tokenLimit,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
        })));
    });
    // GET /api/tasks/:id â€” get single task detail
    app.get('/api/tasks/:id', (req, res) => {
        const state = taskState_1.taskStateManager.load(String(req.params.id));
        if (!state) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        res.json(state);
    });
    // POST /api/tasks/:id/retry â€” reset a failed task and re-run recovery
    app.post('/api/tasks/:id/retry', async (req, res) => {
        const state = taskState_1.taskStateManager.load(String(req.params.id));
        if (!state) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        if (state.status !== 'failed') {
            res.status(400).json({ error: 'Task is not failed' });
            return;
        }
        // Reset to running so recoverTasks picks it up
        state.status = 'running';
        taskState_1.taskStateManager.save(state);
        (0, taskRecovery_1.recoverTasks)().catch(() => { });
        res.json({ success: true, message: `Retrying task ${req.params.id}` });
    });
    // GET /api/memory â€” return current conversation facts and recent history
    app.get('/api/memory', (_req, res) => {
        res.json({
            facts: conversationMemory_1.conversationMemory.getFacts(),
            recentHistory: conversationMemory_1.conversationMemory.getRecentHistory(),
        });
    });
    // DELETE /api/memory â€” clear all conversation memory
    app.delete('/api/memory', (_req, res) => {
        conversationMemory_1.conversationMemory.clear();
        res.json({ success: true, message: 'Conversation memory cleared' });
    });
    // GET /api/memory/semantic?q=query â€” semantic search or stats
    app.get('/api/memory/semantic', (req, res) => {
        const query = req.query.q;
        if (!query) {
            res.json(semanticMemory_1.semanticMemory.getStats());
            return;
        }
        const results = semanticMemory_1.semanticMemory.searchText(query, 5);
        res.json({ query, results });
    });
    // GET /api/memory/graph?entity=name â€” entity relationships or graph overview
    app.get('/api/memory/graph', (req, res) => {
        const entity = req.query.entity;
        if (entity) {
            res.json({ entity, related: entityGraph_1.entityGraph.getRelated(entity) });
        }
        else {
            res.json({
                stats: entityGraph_1.entityGraph.getStats(),
                frequent: entityGraph_1.entityGraph.getFrequent(10),
            });
        }
    });
    // GET /api/memory/learning?q=query â€” learning stats or similar past experiences
    app.get('/api/memory/learning', (req, res) => {
        const query = req.query.q;
        res.json({
            stats: learningMemory_1.learningMemory.getStats(),
            similar: query ? learningMemory_1.learningMemory.findSimilar(query) : [],
        });
    });
    // GET /api/memory/sessions â€” list all session IDs
    app.get('/api/memory/sessions', (_req, res) => {
        res.json({ sessions: conversationMemory_1.conversationMemory.getSessions() });
    });
    // GET /api/screenshot â€” serve latest screenshot from workspace/screenshots/
    app.get('/api/screenshot', (_req, res) => {
        try {
            const dir = path.join(process.cwd(), 'workspace', 'screenshots');
            if (!fs.existsSync(dir)) {
                res.status(404).end();
                return;
            }
            const files = fs.readdirSync(dir)
                .filter((f) => f.endsWith('.png'))
                .sort().reverse();
            if (!files.length) {
                res.status(404).end();
                return;
            }
            const imgPath = path.join(dir, files[0]);
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'no-cache, no-store');
            res.send(fs.readFileSync(imgPath));
        }
        catch {
            res.status(500).end();
        }
    });
    // GET /api/stocks â€” fetch stock data via Yahoo Finance or DuckDuckGo
    app.get('/api/stocks', async (req, res) => {
        const query = req.query.q || 'NSE top gainers';
        try {
            const yahooUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;
            const r1 = await fetch(yahooUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0' }
            });
            if (r1.ok) {
                const data = await r1.json();
                return res.json({ source: 'yahoo', data });
            }
        }
        catch { }
        try {
            const r2 = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' stock price NSE BSE')}&format=json&no_html=1`);
            const data = await r2.json();
            return res.json({ source: 'ddg', data });
        }
        catch { }
        res.status(500).json({ error: 'Stock data unavailable' });
    });
    // GET /api/screen/size â€” get primary screen dimensions
    app.get('/api/screen/size', async (_req, res) => {
        try {
            const size = await (0, computerControl_1.getScreenSize)();
            res.json(size);
        }
        catch {
            res.json({ width: 1920, height: 1080 });
        }
    });
    // POST /api/screenshot/capture â€” trigger a screenshot and return its path
    app.post('/api/screenshot/capture', async (_req, res) => {
        try {
            const filepath = await (0, computerControl_1.takeScreenshot)();
            res.json({ success: true, path: filepath });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // GET /api/mcp/list â€” list connected MCP plugins (stub)
    app.get('/api/mcp/list', (_req, res) => {
        res.json({ plugins: [] });
    });
    // POST /api/mcp/connect â€” connect a new MCP plugin (stub)
    app.post('/api/mcp/connect', (_req, res) => {
        res.json({ success: true });
    });
    // â”€â”€ Voice endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // GET /api/voice/status â€” check STT and TTS availability
    app.get('/api/voice/status', async (_req, res) => {
        const [stt, tts] = await Promise.all([(0, voiceInput_1.checkVoiceAvailable)(), (0, voiceOutput_1.checkTTSAvailable)()]);
        res.json({ stt, tts });
    });
    // POST /api/voice/record â€” record audio from microphone (Pro only)
    // body: { duration?: number }  (ms, default 5000)
    app.post('/api/voice/record', async (req, res) => {
        if (!(0, licenseManager_1.isPro)()) {
            res.status(403).json({ success: false, error: 'Pro license required', upgrade: true });
            return;
        }
        try {
            const duration = Math.min(Number(req.body?.duration) || 5000, 15000);
            const audioPath = await (0, voiceInput_1.recordAudio)(duration);
            res.json({ success: true, path: audioPath });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    // POST /api/voice/transcribe â€” transcribe a recorded audio file
    // body: { path: string }
    app.post('/api/voice/transcribe', async (req, res) => {
        try {
            const { path: audioPath } = req.body;
            if (!audioPath) {
                res.status(400).json({ error: 'path required' });
                return;
            }
            const text = await (0, voiceInput_1.transcribeAudio)(audioPath);
            res.json({ success: true, text });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    // POST /api/voice/speak â€” speak text aloud (non-blocking) (Pro only)
    // body: { text: string, voice?: string }
    app.post('/api/voice/speak', async (req, res) => {
        if (!(0, licenseManager_1.isPro)()) {
            res.status(403).json({ success: false, error: 'Pro license required', upgrade: true });
            return;
        }
        try {
            const { text, voice } = req.body;
            if (!text) {
                res.status(400).json({ error: 'text required' });
                return;
            }
            // Fire and forget â€” response returns immediately while audio plays
            (0, voiceOutput_1.speak)(text, voice).catch(e => console.error('[TTS] speak error:', e.message));
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    // â”€â”€ 404 catch-all â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // ── UserCognitionProfile ────────────────────────────────────────
    // GET /api/cognition/profile — current inferred user cognitive style
    app.get('/api/cognition/profile', (_req, res) => {
        try {
            res.json(userCognitionProfile_1.userCognitionProfile.getProfile());
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // ── GrowthEngine ──────────────────────────────────────────────
    // GET /api/growth/report — weekly summary: successes, failures, gaps, proposals
    app.get('/api/growth/report', (_req, res) => {
        try {
            res.json(growthEngine_1.growthEngine.getWeeklyReport());
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // GET /api/growth/gaps — live capability gap analysis
    app.get('/api/growth/gaps', (_req, res) => {
        try {
            res.json({ gaps: growthEngine_1.growthEngine.analyze() });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // GET /api/growth/failures — recent failure log (raw JSONL lines)
    app.get('/api/growth/failures', (_req, res) => {
        try {
            const limitParam = parseInt(_req.query?.limit || '20', 10);
            const logPath = require('path').join(process.cwd(), 'workspace', 'growth', 'failure-log.jsonl');
            const fs2 = require('fs');
            if (!fs2.existsSync(logPath)) {
                res.json({ failures: [] });
                return;
            }
            const lines = fs2.readFileSync(logPath, 'utf-8').trim().split('\n').filter(Boolean);
            const recent = lines.slice(-limitParam).map((l) => { try {
                return JSON.parse(l);
            }
            catch {
                return null;
            } }).filter(Boolean);
            res.json({ failures: recent });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.use((_req, res) => {
        res.status(404).json({ error: 'Not found' });
    });
    return app;
}
// â”€â”€ Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getDefaultModel(provider) {
    const defaults = {
        groq: 'llama-3.3-70b-versatile',
        openrouter: 'meta-llama/llama-3.3-70b-instruct',
        gemini: 'gemini-1.5-flash',
        cerebras: 'llama3.1-8b',
        nvidia: 'meta/llama-3.3-70b-instruct',
    };
    return defaults[provider] || 'llama-3.3-70b-versatile';
}
// â”€â”€ Startup health check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Validates that every core subsystem initialises without throwing.
// Logs a summary so operators can spot broken modules at boot time.
function startupCheck() {
    const checks = [];
    // SkillLoader
    try {
        const skills = skillLoader_1.skillLoader.loadAll();
        checks.push({ name: 'SkillLoader', ok: true, detail: `${skills.length} skill(s) loaded` });
    }
    catch (e) {
        checks.push({ name: 'SkillLoader', ok: false, detail: e.message });
    }
    // KnowledgeBase
    try {
        const stats = knowledgeBase_1.knowledgeBase.getStats();
        checks.push({ name: 'KnowledgeBase', ok: true, detail: `${stats.files} file(s), ${stats.chunks} chunk(s)` });
    }
    catch (e) {
        checks.push({ name: 'KnowledgeBase', ok: false, detail: e.message });
    }
    // SkillTeacher
    try {
        const stats = skillTeacher_1.skillTeacher.getStats();
        checks.push({ name: 'SkillTeacher', ok: true, detail: `${stats.learned} learned, ${stats.approved} approved` });
    }
    catch (e) {
        checks.push({ name: 'SkillTeacher', ok: false, detail: e.message });
    }
    // ConversationMemory
    try {
        conversationMemory_1.conversationMemory.getFacts();
        checks.push({ name: 'ConversationMemory', ok: true });
    }
    catch (e) {
        checks.push({ name: 'ConversationMemory', ok: false, detail: e.message });
    }
    // SemanticMemory
    try {
        const stats = semanticMemory_1.semanticMemory.getStats();
        checks.push({ name: 'SemanticMemory', ok: true, detail: `${stats.total} item(s)` });
    }
    catch (e) {
        checks.push({ name: 'SemanticMemory', ok: false, detail: e.message });
    }
    // EntityGraph
    try {
        const stats = entityGraph_1.entityGraph.getStats();
        checks.push({ name: 'EntityGraph', ok: true, detail: `${stats.nodes} node(s), ${stats.edges} edge(s)` });
    }
    catch (e) {
        checks.push({ name: 'EntityGraph', ok: false, detail: e.message });
    }
    // Print summary
    const allOk = checks.every(c => c.ok);
    console.log(`[Startup] Health check â€” ${allOk ? 'ALL OK' : 'SOME FAILED'}`);
    for (const c of checks) {
        const icon = c.ok ? 'âœ“' : 'âœ—';
        const detail = c.detail ? ` â€” ${c.detail}` : '';
        console.log(`[Startup]   ${icon} ${c.name}${detail}`);
    }
}
// â”€â”€ Server launcher â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function startApiServer(portArg) {
    // Read port from config/api.json with sensible fallback
    let port = portArg ?? 4200;
    let host = '127.0.0.1';
    try {
        const cfgPath = path.join(process.cwd(), 'config', 'api.json');
        if (fs.existsSync(cfgPath)) {
            const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
            host = cfg.host || host;
            port = cfg.port || port;
        }
    }
    catch { /* use defaults */ }
    // â”€â”€ TASK 2: Process-level error handlers â€” prevent silent crashes â”€
    process.on('unhandledRejection', (reason) => {
        console.error('[Process] Unhandled promise rejection:', reason?.message ?? reason);
        try {
            livePulse_1.livePulse.error('Aiden', `Unhandled rejection: ${String(reason?.message ?? reason).slice(0, 100)}`);
        }
        catch { }
    });
    process.on('uncaughtException', (err) => {
        console.error('[Process] Uncaught exception:', err.message);
        console.error('[Process] Stack:', err.stack?.split('\n').slice(0, 5).join('\n'));
        try {
            livePulse_1.livePulse.error('Aiden', `Uncaught exception: ${err.message.slice(0, 100)}`);
        }
        catch { }
        // Do NOT exit â€” let the server keep running for other requests
    });
    const app = createApiServer();
    const server = http.createServer(app);
    // â”€â”€ Startup health check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try {
        startupCheck();
    }
    catch (e) {
        console.error('[Startup] startupCheck threw:', e.message);
    }
    // â”€â”€ WebSocket server â€” LivePulse bridge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const wss = new ws_1.WebSocketServer({ server });
    const wsClients = new Set();
    wss.on('connection', (ws) => {
        wsClients.add(ws);
        wsBroadcastClients.add(ws);
        // Send last 20 history events to newly connected client so UI isn't blank
        const recentHistory = livePulse_1.livePulse.getHistory().slice(-20);
        recentHistory.forEach(event => {
            try {
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({ type: 'pulse', event }));
                }
            }
            catch { }
        });
        ws.on('close', () => { wsClients.delete(ws); wsBroadcastClients.delete(ws); });
        ws.on('error', () => { wsClients.delete(ws); wsBroadcastClients.delete(ws); });
    });
    // Forward ALL livePulse events to ALL connected WebSocket clients
    livePulse_1.livePulse.on('any', (event) => {
        const payload = JSON.stringify({ type: 'pulse', event });
        wsClients.forEach(ws => {
            try {
                if (ws.readyState === ws.OPEN)
                    ws.send(payload);
            }
            catch { }
        });
    });
    // Stale task cleanup â€” mark running tasks older than 1h as failed (runs before recovery)
    try {
        const tasksDir = path.join(process.cwd(), 'workspace', 'tasks');
        if (fs.existsSync(tasksDir)) {
            const taskDirs = fs.readdirSync(tasksDir)
                .filter((d) => d.startsWith('task_'));
            let cleaned = 0;
            for (const dir of taskDirs) {
                const statePath = path.join(tasksDir, dir, 'state.json');
                if (!fs.existsSync(statePath))
                    continue;
                try {
                    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
                    const ageHours = (Date.now() - (state.createdAt || 0)) / (1000 * 60 * 60);
                    if (state.status === 'running' && ageHours > 1) {
                        state.status = 'failed';
                        state.error = 'Auto-cleaned: task interrupted and too old to recover';
                        fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
                        cleaned++;
                    }
                }
                catch { }
            }
            if (cleaned > 0)
                console.log(`[Startup] Cleaned up ${cleaned} stale interrupted tasks`);
        }
    }
    catch { }
    // Sprint 30: refresh Aiden identity on startup
    setTimeout(() => { try {
        (0, aidenIdentity_1.refreshIdentity)();
    }
    catch { } }, 2000);
    // Run crash recovery on startup â€” non-blocking, finds 'running' tasks from prior session
    (0, taskRecovery_1.recoverTasks)().catch(e => console.error('[Startup] Recovery error:', e.message));
    // Start background license refresh (12-hour interval, silent)
    (0, licenseManager_1.startLicenseRefresh)();
    // Log provider chain before listening so it's visible in startup log
    try {
        (0, router_1.logProviderStatus)();
    }
    catch { }
    server.listen(port, host, () => {
        console.log(`[API] DevOS v2.0 Â· Aiden running at http://${host}:${port}`);
        console.log(`[API] Health: http://${host}:${port}/api/health`);
        console.log(`[API] LivePulse WS: ws://${host}:${port}`);
    });
    return app;
}
// ── Provider racing helpers ─────────────────────────────────
// fetchProviderResponse: fires a single non-streaming request to a provider.
// raceProviders: fires top-2 simultaneously, returns the fastest valid response.
async function fetchProviderResponse(api, messages, signal) {
    const key = api.key.startsWith('env:')
        ? (process.env[api.key.replace('env:', '')] || '')
        : api.key;
    const providerType = api.provider;
    const model = api.model;
    if (providerType === 'gemini') {
        const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify({ model, messages, stream: false }),
            signal,
        });
        if (!resp.ok)
            throw new Error(`Gemini ${resp.status}`);
        const d = await resp.json();
        return { text: d?.choices?.[0]?.message?.content || '', apiName: api.name };
    }
    else if (providerType === 'ollama') {
        const resp = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages, stream: false }),
            signal,
        });
        if (!resp.ok)
            throw new Error(`Ollama ${resp.status}`);
        const d = await resp.json();
        return { text: d?.message?.content || '', apiName: api.name };
    }
    else {
        const COMPAT_ENDPOINTS = {
            groq: 'https://api.groq.com/openai/v1/chat/completions',
            openrouter: 'https://openrouter.ai/api/v1/chat/completions',
            cerebras: 'https://api.cerebras.ai/v1/chat/completions',
            openai: 'https://api.openai.com/v1/chat/completions',
            nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions',
            github: 'https://models.inference.ai.azure.com/chat/completions',
        };
        const endpoint = COMPAT_ENDPOINTS[providerType] ?? COMPAT_ENDPOINTS['groq'];
        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
                ...(providerType === 'openrouter' ? { 'HTTP-Referer': 'https://devos.local', 'X-Title': 'DevOS' } : {}),
            },
            body: JSON.stringify({ model, messages, stream: false, max_tokens: 2000 }),
            signal,
        });
        if (!resp.ok)
            throw new Error(`${providerType} ${resp.status}`);
        const d = await resp.json();
        return { text: d?.choices?.[0]?.message?.content || '', apiName: api.name };
    }
}
async function raceProviders(messages, topN = 2) {
    const cfg = (0, index_1.loadConfig)();
    const apis = cfg.providers.apis
        .filter(a => {
        if (!a.enabled || a.rateLimited)
            return false;
        const k = a.key.startsWith('env:') ? (process.env[a.key.replace('env:', '')] || '') : a.key;
        return k.length > 0 && a.provider !== 'ollama';
    })
        .slice(0, topN);
    if (apis.length < 2)
        return null;
    const controllers = apis.map(() => new AbortController());
    const promises = apis.map((api, i) => fetchProviderResponse(api, messages, controllers[i].signal).then(result => {
        controllers.forEach((c, j) => { if (j !== i) {
            try {
                c.abort();
            }
            catch { }
        } });
        return result;
    }));
    try {
        const winner = await Promise.race(promises);
        if (winner.text.trim())
            return winner;
    }
    catch { }
    return null;
}
// ── Pure-chat streaming helper (no planner, no tools) ─────────
async function streamChat(message, history, userName, _provider, model, apiName, send, sessionId) {
    // ── Sprint 1: First Message WOW — silent system context gathering ───────────────────
    const isFirstMessage = history.length === 0;
    let firstMessageContext = '';
    if (isFirstMessage) {
        try {
            const [sysResult, windowsResult, diskResult] = await Promise.allSettled([
                (0, toolRegistry_1.executeTool)('system_info', {}),
                (0, toolRegistry_1.executeTool)('shell_exec', { command: 'Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | Select-Object Name, MainWindowTitle, @{N="RAM_MB";E={[math]::Round($_.WorkingSet64/1MB,1)}} | ConvertTo-Json -Compress' }),
                (0, toolRegistry_1.executeTool)('shell_exec', { command: 'Get-PSDrive C | Select-Object @{N="UsedGB";E={[math]::Round(($_.Used/1GB),1)}}, @{N="FreeGB";E={[math]::Round(($_.Free/1GB),1)}} | ConvertTo-Json -Compress' }),
            ]);
            const sysInfo = sysResult.status === 'fulfilled' ? sysResult.value.output ?? '' : '';
            const windows = windowsResult.status === 'fulfilled' ? windowsResult.value.output ?? '' : '';
            const disk = diskResult.status === 'fulfilled' ? diskResult.value.output ?? '' : '';
            firstMessageContext = `\n\nSYSTEM CONTEXT (you silently gathered this — use it to show awareness of the user’s machine):\nHardware: ${sysInfo}\nOpen windows: ${windows}\nDisk: ${disk}\n\nOn this first message, respond by showing what you can see on their machine right now. Be specific and natural — not a feature list. Example: \"I can see you have VS Code open, 6GB RAM free, and your disk is 78% full. What are you working on?\"`;
        }
        catch { /* silent — never block the response */ }
    }
    const cognitionHint = userCognitionProfile_1.userCognitionProfile.getSystemPromptAddition();
    // Sprint 21: proactive memory surfacing
    let memoryContext = '';
    try {
        const recalled = await (0, memoryRecall_1.unifiedMemoryRecall)(message, 5);
        memoryContext = (0, memoryRecall_1.buildMemoryInjection)(recalled);
        if (recalled.relevant.length > 0) {
            memoryContext += `\nProactive: if any memory context is directly relevant to the user's message, naturally reference it. Example: "I remember you mentioned X..." \xe2\x80\x94 but only if genuinely relevant, not forced.`;
        }
    }
    catch { }
    // Sprint 30: inject last session context on first message
    let sessionContext = '';
    if (isFirstMessage && sessionId) {
        try {
            const lastCtx = sessionMemory_1.sessionMemory.getLastContext(sessionId);
            if (lastCtx)
                sessionContext = `\n\nPRIOR SESSION CONTEXT:\n${lastCtx}`;
        }
        catch { }
    }
    // Sprint 30: inject long-term memory index
    let memoryIndex = '';
    try {
        const idx = memoryExtractor_1.memoryExtractor.loadMemoryIndex();
        if (idx)
            memoryIndex = `\n\nMEMORY INDEX (topics you've learned about this user — use as background, not to recite):\n${idx}`;
    }
    catch { }
    // [Aiden] System prompt v5 — HARD RULES active
    const chatPrompt = `You are Aiden — a personal AI OS built for ${userName}. You are sharp, direct, and slightly witty. You speak like a trusted co-founder. Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.

HARD RULES — never violate:
- Never say "As an AI language model...", "I'm here to assist", "Certainly!", "Great question!", "Of course!"
- Never say "key findings from our research", "as per your request I have written", "here is a comparison of", "verdict:", "recommendation:" in a generic reply
- Never mention Pega, BlueWinston, Gaude Digital, or any third-party product by name
- Never say you can't access the internet (you have web_search) or can't create files (you have file_write)
- Never fabricate capabilities: no graphic design, video production, or music generation
- Never list 250+ skills — you have 23 real tools
- For errors: explain what failed and what to try next
- If you don't know something: say "I don't know"
- Direct and concise: 1–3 sentences for simple results; more only when output is rich
${cognitionHint}${firstMessageContext}${memoryContext}${sessionContext}${memoryIndex}`;
    const msgs = [
        { role: 'system', content: chatPrompt },
        ...history.slice(-8),
        { role: 'user', content: message },
    ];
    // ── Sprint 5: Provider racing ─ fire top-2, stream winner's tokens ───────────
    try {
        const raceResult = await raceProviders(msgs);
        if (raceResult) {
            // Simulate streaming: send each word as a token for natural feel
            const words = raceResult.text.split(' ');
            for (let wi = 0; wi < words.length; wi++) {
                const token = (wi === 0 ? '' : ' ') + words[wi];
                send({ token, done: false, provider: raceResult.apiName });
            }
            return;
        }
    }
    catch { /* racing failed — fall through to sequential */ }
    // Sprint 6: use responder tier for streamChat provider selection
    const cfg = (0, index_1.loadConfig)();
    const responderChat = (0, router_1.getModelForTask)('responder');
    const providerType = responderChat.providerName;
    const apiKey = responderChat.apiKey;
    const activeStreamModel = responderChat.model || model; // tiered model overrides caller's model
    let streamEnded = false;
    const timeout = setTimeout(() => {
        if (!streamEnded)
            send({ done: true, error: 'Chat timeout' });
    }, 35000);
    try {
        if (providerType === 'gemini') {
            // ── Gemini via OpenAI-compat endpoint ─────────────────────
            const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({ model: activeStreamModel, messages: msgs, stream: true }),
            });
            if (!resp.ok || !resp.body) {
                const errText = await resp.text().catch(() => resp.statusText);
                if (resp.status === 429)
                    (0, router_1.markRateLimited)(apiName);
                throw new Error(`Gemini ${resp.status}: ${errText}`);
            }
            const reader = resp.body.getReader();
            const dec = new TextDecoder();
            let buf = '';
            while (true) {
                const { value, done } = await reader.read();
                if (done)
                    break;
                buf += dec.decode(value, { stream: true });
                const lines = buf.split('\n');
                buf = lines.pop() ?? '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data:'))
                        continue;
                    const data = trimmed.slice(5).trim();
                    if (data === '[DONE]')
                        break;
                    try {
                        const parsed = JSON.parse(data);
                        const token = parsed.choices?.[0]?.delta?.content;
                        if (token)
                            send({ token, done: false, provider: apiName });
                    }
                    catch { /* skip malformed chunks */ }
                }
            }
        }
        else if (providerType === 'ollama') {
            // ── Ollama — local streaming ───────────────────────────────
            const resp = await fetch('http://localhost:11434/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: activeStreamModel, messages: msgs, stream: true }),
            });
            if (!resp.ok || !resp.body) {
                throw new Error(`Ollama ${resp.status}: ${resp.statusText}`);
            }
            const reader = resp.body.getReader();
            const dec = new TextDecoder();
            let buf = '';
            while (true) {
                const { value, done } = await reader.read();
                if (done)
                    break;
                buf += dec.decode(value, { stream: true });
                const lines = buf.split('\n');
                buf = lines.pop() ?? '';
                for (const line of lines) {
                    if (!line.trim())
                        continue;
                    try {
                        const parsed = JSON.parse(line);
                        const token = parsed.message?.content;
                        if (token)
                            send({ token, done: false, provider: apiName });
                    }
                    catch { /* skip malformed */ }
                }
            }
        }
        else {
            // ── OpenAI-compatible (Groq, OpenRouter, Cerebras, etc.) ──
            const ENDPOINTS = {
                groq: 'https://api.groq.com/openai/v1/chat/completions',
                openrouter: 'https://openrouter.ai/api/v1/chat/completions',
                cerebras: 'https://api.cerebras.ai/v1/chat/completions',
                openai: 'https://api.openai.com/v1/chat/completions',
            };
            const endpoint = ENDPOINTS[providerType] ?? ENDPOINTS['groq'];
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    ...(providerType === 'openrouter' ? { 'HTTP-Referer': 'https://devos.local', 'X-Title': 'DevOS' } : {}),
                },
                body: JSON.stringify({ model: activeStreamModel, messages: msgs, stream: true }),
            });
            if (!resp.ok || !resp.body) {
                const errText = await resp.text().catch(() => resp.statusText);
                if (resp.status === 429)
                    (0, router_1.markRateLimited)(apiName);
                throw new Error(`${providerType} ${resp.status}: ${errText}`);
            }
            const reader = resp.body.getReader();
            const dec = new TextDecoder();
            let buf = '';
            while (true) {
                const { value, done } = await reader.read();
                if (done)
                    break;
                buf += dec.decode(value, { stream: true });
                const lines = buf.split('\n');
                buf = lines.pop() ?? '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data:'))
                        continue;
                    const data = trimmed.slice(5).trim();
                    if (data === '[DONE]')
                        break;
                    try {
                        const parsed = JSON.parse(data);
                        const token = parsed.choices?.[0]?.delta?.content;
                        if (token)
                            send({ token, done: false, provider: apiName });
                    }
                    catch { /* skip malformed chunks */ }
                }
            }
        }
    }
    catch (err) {
        // Primary failed — try Ollama as last-resort fallback
        if (providerType !== 'ollama') {
            console.warn(`[streamChat] ${providerType} failed (${err?.message}) — falling back to Ollama`);
            try {
                const ollamaModel = cfg.model?.activeModel || 'mistral:7b';
                const resp = await fetch('http://localhost:11434/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: ollamaModel, messages: msgs, stream: true }),
                });
                if (resp.ok && resp.body) {
                    const reader = resp.body.getReader();
                    const dec = new TextDecoder();
                    let buf = '';
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done)
                            break;
                        buf += dec.decode(value, { stream: true });
                        const lines = buf.split('\n');
                        buf = lines.pop() ?? '';
                        for (const line of lines) {
                            if (!line.trim())
                                continue;
                            try {
                                const parsed = JSON.parse(line);
                                const token = parsed.message?.content;
                                if (token)
                                    send({ token, done: false, provider: 'ollama' });
                            }
                            catch { /* skip */ }
                        }
                    }
                    streamEnded = true;
                    clearTimeout(timeout);
                    return;
                }
            }
            catch (ollamaErr) {
                console.error('[streamChat] Ollama fallback also failed:', ollamaErr);
            }
        }
        // Both failed — send a graceful error token
        send({ token: `Sorry, I could not reach any AI provider right now. Error: ${err?.message ?? 'unknown'}`, done: false, provider: 'error' });
    }
    streamEnded = true;
    clearTimeout(timeout);
}
