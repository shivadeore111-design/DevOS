"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategicPlanner = void 0;
// ============================================================
// core/strategicPlanner.ts — DevOS Strategic Planner
// CTO-mode brain: milestones, risks, overengineering detection
// ============================================================
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const router_1 = require("../llm/router");
// ── Overengineering & Risk Patterns ─────────────────────────
const OVERENGINEERING_PATTERNS = [
    'microservices',
    'kubernetes',
    'graphql',
    'event sourcing',
    'custom auth',
    'service mesh',
    'multi-region replication',
    'cqrs',
    'saga pattern',
    'custom orm',
    'websockets for polling',
];
const RISK_CHECKS = [
    {
        check: (t) => !t.includes('auth'),
        risk: {
            level: 'high',
            issue: 'No authentication mentioned in plan',
            mitigation: 'Add JWT or session-based auth before any user-facing feature',
        },
    },
    {
        check: (t) => t.includes('plaintext password'),
        risk: {
            level: 'critical',
            issue: 'Plaintext password handling detected',
            mitigation: 'Use bcrypt or argon2 for all password storage',
        },
    },
    {
        check: (t) => !t.includes('rate limit'),
        risk: {
            level: 'medium',
            issue: 'No rate limiting mentioned',
            mitigation: 'Add express-rate-limit or equivalent before launch',
        },
    },
    {
        check: (t) => !t.includes('validation') && !t.includes('sanitiz'),
        risk: {
            level: 'high',
            issue: 'No input validation mentioned',
            mitigation: 'Add Zod or joi validation on all API inputs',
        },
    },
    {
        check: (t) => t.includes('secret') && t.includes('hardcode'),
        risk: {
            level: 'critical',
            issue: 'Hardcoded secrets detected',
            mitigation: 'Move all secrets to .env — never commit to git',
        },
    },
];
// ── StrategicPlanner Class ───────────────────────────────────
class StrategicPlanner {
    /**
     * Creates a full strategic plan using LLM reasoning.
     * Falls back gracefully if LLM returns malformed JSON.
     */
    static async createStrategicPlan(goal) {
        const systemPrompt = `You are a CTO-level strategic planner with 15 years building SaaS products.
Be pragmatic. Favor simple solutions. Flag overengineering ruthlessly.
Return ONLY valid JSON — no markdown, no explanation, no code fences.`;
        const userPrompt = `Create a milestone execution plan for this product:

Description: ${goal.description}
Target Market: ${goal.targetMarket}
Timeline: ${goal.timelineWeeks} weeks
Budget: ${goal.budgetConstraint}

Return this exact JSON structure:
{
  "milestones": [
    {
      "phase": "Phase name",
      "estimatedDays": 7,
      "technicalTasks": ["task1", "task2"],
      "successCriteria": ["criterion1"],
      "dependencies": []
    }
  ],
  "recommendedStack": {
    "frontend": "Next.js",
    "backend": "Express",
    "database": "PostgreSQL",
    "auth": "Clerk",
    "deployment": "Railway"
  },
  "architectureDecision": "approved",
  "escalationTriggers": ["When to ask human for help"]
}`;
        let parsed = null;
        try {
            const response = await (0, router_1.llmCall)(userPrompt, systemPrompt);
            const text = response.content;
            const jsonMatch = text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
            }
        }
        catch (err) {
            console.warn('[StrategicPlanner] LLM parse failed, using safe defaults:', err);
        }
        const milestones = (parsed?.milestones || []).map((m) => ({
            phase: m.phase || 'Unnamed Phase',
            estimatedDays: typeof m.estimatedDays === 'number' ? m.estimatedDays : 7,
            technicalTasks: Array.isArray(m.technicalTasks) ? m.technicalTasks : [],
            successCriteria: Array.isArray(m.successCriteria) ? m.successCriteria : [],
            dependencies: Array.isArray(m.dependencies) ? m.dependencies : [],
        }));
        // Normalize recommendedStack — GPT sometimes returns array, sometimes object
        let recommendedStack = {};
        if (Array.isArray(parsed?.recommendedStack)) {
            parsed.recommendedStack.forEach((s, i) => {
                recommendedStack[`item_${i + 1}`] = s;
            });
        }
        else if (parsed?.recommendedStack && typeof parsed.recommendedStack === 'object') {
            recommendedStack = parsed.recommendedStack;
        }
        const architectureDecision = ['approved', 'review_recommended', 'blocked'].includes(parsed?.architectureDecision)
            ? parsed.architectureDecision
            : 'review_recommended';
        const escalationTriggers = Array.isArray(parsed?.escalationTriggers)
            ? parsed.escalationTriggers
            : ['LLM returns invalid output 3x in a row', 'Security-critical decision needed'];
        const overengineeringFlags = StrategicPlanner.detectOverengineering(milestones);
        const risks = StrategicPlanner.detectRisks(milestones);
        const estimatedTotalDays = milestones.reduce((sum, m) => sum + m.estimatedDays, 0);
        return {
            goal: goal.description,
            milestones,
            risks,
            overengineeringFlags,
            recommendedStack,
            architectureDecision,
            escalationTriggers,
            estimatedTotalDays,
        };
    }
    /**
     * Detects overengineering patterns in milestone text.
     */
    static detectOverengineering(milestones) {
        const flags = [];
        const joined = JSON.stringify(milestones).toLowerCase();
        for (const pattern of OVERENGINEERING_PATTERNS) {
            if (joined.includes(pattern)) {
                flags.push(`⚠️  Overengineering detected: "${pattern}" — reconsider for MVP stage`);
            }
        }
        return flags;
    }
    /**
     * Detects risky security/architectural patterns.
     */
    static detectRisks(milestones) {
        const joined = JSON.stringify(milestones).toLowerCase();
        return RISK_CHECKS
            .filter(({ check }) => check(joined))
            .map(({ risk }) => risk);
    }
    /**
     * Evaluates a single architecture proposal and returns a verdict.
     */
    static evaluateArchitectureDecision(proposal) {
        const lower = proposal.toLowerCase();
        if (lower.includes('plaintext password') || lower.includes('no authentication')) {
            return 'blocked';
        }
        if (lower.includes('microservice') ||
            lower.includes('kubernetes') ||
            lower.includes('custom auth') ||
            lower.includes('build our own auth')) {
            return 'review_recommended';
        }
        return 'approved';
    }
    /**
     * Saves the strategic plan to workspace/plans/ as a markdown file.
     */
    static savePlan(plan) {
        const dir = path_1.default.join(process.cwd(), 'workspace', 'plans');
        fs_1.default.mkdirSync(dir, { recursive: true });
        const filename = `plan-${Date.now()}.md`;
        const filepath = path_1.default.join(dir, filename);
        fs_1.default.writeFileSync(filepath, StrategicPlanner.formatPlanReport(plan), 'utf-8');
        console.log(`[StrategicPlanner] Plan saved → ${filepath}`);
        return filepath;
    }
    /**
     * Returns a clean CLI-formatted report string.
     */
    static formatPlanReport(plan) {
        const lines = [
            '╔══════════════════════════════════════════╗',
            '║       DEVOS STRATEGIC PLAN REPORT        ║',
            '╚══════════════════════════════════════════╝',
            '',
            `GOAL: ${plan.goal}`,
            `ESTIMATED TOTAL: ${plan.estimatedTotalDays} days`,
            `ARCHITECTURE VERDICT: ${plan.architectureDecision.toUpperCase()}`,
            '',
            '── RECOMMENDED STACK ───────────────────────',
        ];
        for (const [k, v] of Object.entries(plan.recommendedStack)) {
            lines.push(`  ${k.padEnd(12)}: ${v}`);
        }
        lines.push('', '── MILESTONES ──────────────────────────────');
        plan.milestones.forEach((m, i) => {
            lines.push(``, `  Phase ${i + 1}: ${m.phase}  (~${m.estimatedDays}d)`);
            m.technicalTasks.forEach((t) => lines.push(`    • ${t}`));
            if (m.successCriteria.length > 0) {
                lines.push(`    ✓ ${m.successCriteria.join('  ✓ ')}`);
            }
        });
        if (plan.overengineeringFlags.length > 0) {
            lines.push('', '── OVERENGINEERING FLAGS ───────────────────');
            plan.overengineeringFlags.forEach((f) => lines.push(`  ${f}`));
        }
        if (plan.risks.length > 0) {
            lines.push('', '── RISKS ───────────────────────────────────');
            plan.risks.forEach((r) => {
                lines.push(`  [${r.level.toUpperCase()}] ${r.issue}`);
                lines.push(`    → ${r.mitigation}`);
            });
        }
        if (plan.escalationTriggers.length > 0) {
            lines.push('', '── ESCALATION TRIGGERS ─────────────────────');
            plan.escalationTriggers.forEach((t) => lines.push(`  ⚡ ${t}`));
        }
        lines.push('', '════════════════════════════════════════════');
        return lines.join('\n');
    }
}
exports.StrategicPlanner = StrategicPlanner;
