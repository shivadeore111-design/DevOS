"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditTrail = exports.AuditTrail = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const AUDIT_PATH = path_1.default.join(process.cwd(), 'workspace', 'audit', 'audit.jsonl');
class AuditTrail {
    constructor() {
        fs_1.default.mkdirSync(path_1.default.dirname(AUDIT_PATH), { recursive: true });
    }
    record(entry) {
        const full = {
            id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            ts: Date.now(),
            ...entry,
        };
        fs_1.default.appendFileSync(AUDIT_PATH, JSON.stringify(full) + '\n');
    }
    getToday() {
        if (!fs_1.default.existsSync(AUDIT_PATH))
            return [];
        const today = new Date().toDateString();
        return fs_1.default.readFileSync(AUDIT_PATH, 'utf-8')
            .trim().split('\n').filter(Boolean)
            .map(l => { try {
            return JSON.parse(l);
        }
        catch {
            return null;
        } })
            .filter(e => e && new Date(e.ts).toDateString() === today);
    }
    formatSummary(entries) {
        if (entries.length === 0)
            return 'No activity today.';
        const success = entries.filter(e => e.success).length;
        const failed = entries.length - success;
        const tools = {};
        for (const e of entries) {
            if (e.tool)
                tools[e.tool] = (tools[e.tool] || 0) + 1;
        }
        const topTools = Object.entries(tools)
            .sort((a, b) => b[1] - a[1]).slice(0, 5)
            .map(([t, c]) => `  ${t}: ${c}x`).join('\n');
        const failures = entries.filter(e => !e.success).slice(-3)
            .map(e => `  - ${e.tool || e.action}: ${e.error || 'unknown error'}`).join('\n');
        return `DevOS Activity — ${new Date().toLocaleDateString()}
Actions: ${entries.length} total | ${success} succeeded | ${failed} failed
Avg duration: ${Math.round(entries.reduce((s, e) => s + e.durationMs, 0) / entries.length)}ms

Top tools:
${topTools || '  none'}
${failures ? `\nRecent failures:\n${failures}` : ''}`;
    }
}
exports.AuditTrail = AuditTrail;
exports.auditTrail = new AuditTrail();
