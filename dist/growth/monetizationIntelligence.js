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
exports.MonetizationIntelligence = void 0;
// ============================================================
// growth/monetizationIntelligence.ts — DevOS Monetization Engine
// Revenue-first thinking: pricing, funnels, upsells, churn, MRR
// ============================================================
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const router_1 = require("../llm/router");
const WORKSPACE_PATH = path_1.default.join(process.cwd(), 'workspace', 'growth');
// ── Helpers ──────────────────────────────────────────────────
function ensureFolder() {
    fs_1.default.mkdirSync(WORKSPACE_PATH, { recursive: true });
}
function safeParseJSON(text) {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    }
    catch {
        return null;
    }
}
function saveJSON(filename, data) {
    ensureFolder();
    const filepath = path_1.default.join(WORKSPACE_PATH, filename);
    fs_1.default.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[MonetizationIntelligence] Saved → ${filepath}`);
}
function pct(numerator, denominator) {
    if (!denominator)
        return 0;
    return Math.round((numerator / denominator) * 10000) / 100;
}
// ── Industry Benchmarks ──────────────────────────────────────
const BENCHMARKS = {
    visitorToSignup: { good: 5, warn: 2 }, // %
    signupToTrial: { good: 40, warn: 20 }, // %
    trialToPaid: { good: 20, warn: 10 }, // %
};
// ── MonetizationIntelligence Class ───────────────────────────
class MonetizationIntelligence {
    /**
     * Suggest 3 pricing tiers based on product, ICP, and competitor prices.
     */
    static async suggestPricingStrategy(productDescription, icp, competitorPrices) {
        const avgCompetitor = competitorPrices.length
            ? Math.round(competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length)
            : 0;
        const systemPrompt = `You are a SaaS pricing strategist. You understand value-based pricing.
Return ONLY valid JSON array — no markdown, no explanation, no code fences.`;
        const userPrompt = `Suggest 3 pricing tiers for this product.

Product: ${productDescription}
ICP Segment: ${icp.segment}
Competitor avg price: $${avgCompetitor}/mo
Competitor prices: ${competitorPrices.join(', ')}

Pricing psychology rules:
- Tier 1 (Starter): Below competitor avg, capture price-sensitive users
- Tier 2 (Pro): Slightly above avg, most value, mark isRecommended true
- Tier 3 (Business): 2-3x Pro, for teams/enterprises

Return JSON array:
[
  {
    "name": "Starter",
    "price": 19,
    "billingPeriod": "monthly",
    "features": ["feature1", "feature2"],
    "targetSegment": "who this is for",
    "positioningRationale": "why this price makes sense",
    "isRecommended": false
  }
]`;
        const response = await (0, router_1.llmCall)(userPrompt, systemPrompt);
        const parsed = safeParseJSON(response.content);
        const tiers = Array.isArray(parsed)
            ? parsed.map((t) => ({
                name: t.name || 'Plan',
                price: typeof t.price === 'number' ? t.price : 0,
                billingPeriod: t.billingPeriod || 'monthly',
                features: Array.isArray(t.features) ? t.features : [],
                targetSegment: t.targetSegment || '',
                positioningRationale: t.positioningRationale || '',
                isRecommended: t.isRecommended || false,
            }))
            : [];
        saveJSON('pricing-strategy.json', tiers);
        return tiers;
    }
    /**
     * Analyze funnel conversion rates. Fully deterministic — no LLM needed.
     */
    static detectConversionIssues(metrics) {
        const { visitors, signups, trials, paid } = metrics;
        const rates = {
            visitorToSignup: pct(signups, visitors),
            signupToTrial: pct(trials, signups),
            trialToPaid: pct(paid, trials),
            overallConversion: pct(paid, visitors),
        };
        const benchmarks = {
            visitorToSignup: `Good: >${BENCHMARKS.visitorToSignup.good}%  Warn: <${BENCHMARKS.visitorToSignup.warn}%`,
            signupToTrial: `Good: >${BENCHMARKS.signupToTrial.good}%  Warn: <${BENCHMARKS.signupToTrial.warn}%`,
            trialToPaid: `Good: >${BENCHMARKS.trialToPaid.good}%  Warn: <${BENCHMARKS.trialToPaid.warn}%`,
        };
        const dropoffs = [];
        const suggestions = [];
        if (rates.visitorToSignup < BENCHMARKS.visitorToSignup.good) {
            dropoffs.push(`Visitor→Signup: ${rates.visitorToSignup}% (below ${BENCHMARKS.visitorToSignup.good}% benchmark)`);
            suggestions.push('Improve landing page headline, CTA clarity, and social proof');
        }
        if (rates.signupToTrial < BENCHMARKS.signupToTrial.good) {
            dropoffs.push(`Signup→Trial: ${rates.signupToTrial}% (below ${BENCHMARKS.signupToTrial.good}% benchmark)`);
            suggestions.push('Improve onboarding — reduce time-to-value under 5 minutes');
        }
        if (rates.trialToPaid < BENCHMARKS.trialToPaid.good) {
            dropoffs.push(`Trial→Paid: ${rates.trialToPaid}% (below ${BENCHMARKS.trialToPaid.good}% benchmark)`);
            suggestions.push('Add upgrade nudges at feature limits + urgency before trial ends');
        }
        // Identify the single biggest priority
        const priorityFix = rates.visitorToSignup < BENCHMARKS.visitorToSignup.warn
            ? 'CRITICAL: Fix landing page — most visitors never sign up'
            : rates.signupToTrial < BENCHMARKS.signupToTrial.warn
                ? 'CRITICAL: Fix onboarding — users sign up but never activate'
                : rates.trialToPaid < BENCHMARKS.trialToPaid.warn
                    ? 'CRITICAL: Fix trial-to-paid — users try but don\'t convert'
                    : dropoffs.length > 0
                        ? suggestions[0]
                        : 'Funnel is performing within benchmarks — focus on top-of-funnel volume';
        const result = { rates, benchmarks, dropoffs, suggestions, priorityFix };
        saveJSON('funnel-analysis.json', result);
        return result;
    }
    /**
     * Suggest upsell opportunities based on current plan and usage patterns.
     */
    static async suggestUpsells(currentPlan, usagePatterns) {
        const systemPrompt = `You are a SaaS revenue optimization expert.
Return ONLY valid JSON array — no markdown, no explanation, no code fences.`;
        const userPrompt = `Suggest upsell opportunities.

Current Plan: ${currentPlan.name} at $${currentPlan.price}/mo
Features: ${currentPlan.features.join(', ')}
Usage Patterns: ${JSON.stringify(usagePatterns, null, 2)}

Return JSON array:
[
  {
    "triggerCondition": "specific usage signal that triggers this upsell",
    "offer": "what to offer",
    "expectedLift": "estimated MRR impact",
    "urgencyMechanism": "what creates urgency to upgrade"
  }
]`;
        const response = await (0, router_1.llmCall)(userPrompt, systemPrompt);
        const parsed = safeParseJSON(response.content);
        const upsells = Array.isArray(parsed)
            ? parsed.map((u) => ({
                triggerCondition: u.triggerCondition || '',
                offer: u.offer || '',
                expectedLift: u.expectedLift || '',
                urgencyMechanism: u.urgencyMechanism || '',
            }))
            : [];
        saveJSON('upsell-opportunities.json', upsells);
        return upsells;
    }
    /**
     * Map churn reasons to specific retention fixes.
     */
    static async suggestRetentionImprovements(churnReasons) {
        const systemPrompt = `You are a SaaS retention strategist.
Return ONLY valid JSON array — no markdown, no explanation, no code fences.`;
        const userPrompt = `Map each churn reason to a specific retention fix.

Churn Reasons: ${JSON.stringify(churnReasons)}

Return JSON array:
[
  {
    "churnReason": "exact churn reason",
    "retentionFix": "specific actionable fix",
    "timeline": "how long to implement",
    "effort": "low | medium | high"
  }
]`;
        const response = await (0, router_1.llmCall)(userPrompt, systemPrompt);
        const parsed = safeParseJSON(response.content);
        const fixes = Array.isArray(parsed)
            ? parsed.map((f) => ({
                churnReason: f.churnReason || '',
                retentionFix: f.retentionFix || '',
                timeline: f.timeline || '2 weeks',
                effort: ['low', 'medium', 'high'].includes(f.effort) ? f.effort : 'medium',
            }))
            : [];
        saveJSON('retention-improvements.json', fixes);
        return fixes;
    }
    /**
     * Suggest specific interventions per churn pattern.
     */
    static async suggestChurnFixes(churnData) {
        const systemPrompt = `You are a SaaS churn analyst.
Return ONLY valid JSON array — no markdown, no explanation, no code fences.`;
        const userPrompt = `Suggest specific interventions for these churn patterns.

Churn Data: ${JSON.stringify(churnData, null, 2)}

Return JSON array:
[
  {
    "pattern": "churn pattern name",
    "intervention": "specific action to take",
    "impactEstimate": "expected churn reduction %",
    "triggerSignal": "what signal to watch to catch this early"
  }
]`;
        const response = await (0, router_1.llmCall)(userPrompt, systemPrompt);
        const parsed = safeParseJSON(response.content);
        const interventions = Array.isArray(parsed)
            ? parsed.map((c) => ({
                pattern: c.pattern || '',
                intervention: c.intervention || '',
                impactEstimate: c.impactEstimate || '',
                triggerSignal: c.triggerSignal || '',
            }))
            : [];
        saveJSON('churn-interventions.json', interventions);
        return interventions;
    }
    /**
     * Identify expansion MRR opportunities in existing customer base.
     */
    static async identifyExpansionRevenue(currentCustomers) {
        const systemPrompt = `You are a SaaS expansion revenue strategist.
Return ONLY valid JSON array — no markdown, no explanation, no code fences.`;
        const userPrompt = `Identify expansion revenue opportunities.

Current Customers (sample): ${JSON.stringify(currentCustomers.slice(0, 10), null, 2)}

Return JSON array:
[
  {
    "customerSegment": "which customers",
    "expansionOpportunity": "what to offer them",
    "estimatedMRRLift": "$ or % estimate",
    "requiredAction": "what needs to be built or done"
  }
]`;
        const response = await (0, router_1.llmCall)(userPrompt, systemPrompt);
        const parsed = safeParseJSON(response.content);
        const opportunities = Array.isArray(parsed)
            ? parsed.map((o) => ({
                customerSegment: o.customerSegment || '',
                expansionOpportunity: o.expansionOpportunity || '',
                estimatedMRRLift: o.estimatedMRRLift || '',
                requiredAction: o.requiredAction || '',
            }))
            : [];
        saveJSON('expansion-opportunities.json', opportunities);
        return opportunities;
    }
    /**
     * Generate step-by-step plan to grow from currentMRR to targetMRR.
     */
    static async generateMRROptimizationPlan(currentMRR, targetMRR) {
        const gap = targetMRR - currentMRR;
        const growthPct = currentMRR > 0 ? Math.round((gap / currentMRR) * 100) : 0;
        const systemPrompt = `You are a revenue growth strategist. Be specific and realistic.
Return ONLY valid JSON — no markdown, no explanation, no code fences.`;
        const userPrompt = `Create a step-by-step MRR growth plan.

Current MRR: $${currentMRR}
Target MRR: $${targetMRR}
Gap: $${gap} (${growthPct}% growth needed)

Return JSON:
{
  "summary": "2-sentence executive summary of the plan",
  "steps": [
    {
      "step": 1,
      "action": "specific action",
      "lever": "new_revenue | expansion | retention | pricing",
      "expectedImpact": "$ MRR impact estimate",
      "timeframeWeeks": 4
    }
  ]
}`;
        const response = await (0, router_1.llmCall)(userPrompt, systemPrompt);
        const parsed = safeParseJSON(response.content);
        const steps = Array.isArray(parsed?.steps)
            ? parsed.steps.map((s, i) => ({
                step: typeof s.step === 'number' ? s.step : i + 1,
                action: s.action || '',
                lever: ['new_revenue', 'expansion', 'retention', 'pricing'].includes(s.lever)
                    ? s.lever
                    : 'new_revenue',
                expectedImpact: s.expectedImpact || '',
                timeframeWeeks: typeof s.timeframeWeeks === 'number' ? s.timeframeWeeks : 4,
            }))
            : [];
        const plan = {
            currentMRR,
            targetMRR,
            gap,
            steps,
            summary: parsed?.summary || `Grow MRR from $${currentMRR} to $${targetMRR} — $${gap} gap.`,
        };
        saveJSON('mrr-optimization-plan.json', plan);
        return plan;
    }
    /**
     * Print a revenue dashboard summary to the CLI.
     */
    static formatRevenueReport(tiers, funnel, mrrPlan) {
        const lines = [
            '╔══════════════════════════════════════════╗',
            '║     DEVOS MONETIZATION REPORT            ║',
            '╚══════════════════════════════════════════╝',
            '',
            '── PRICING TIERS ───────────────────────────',
        ];
        tiers.forEach((t) => {
            lines.push(`  ${t.isRecommended ? '★' : ' '} ${t.name.padEnd(12)} $${t.price}/mo — ${t.targetSegment}`);
        });
        lines.push('', '── FUNNEL ANALYSIS ─────────────────────────', `  Visitor→Signup:  ${funnel.rates.visitorToSignup}%`, `  Signup→Trial:    ${funnel.rates.signupToTrial}%`, `  Trial→Paid:      ${funnel.rates.trialToPaid}%`, `  Overall:         ${funnel.rates.overallConversion}%`, '', `  🎯 Priority: ${funnel.priorityFix}`);
        if (funnel.suggestions.length > 0) {
            lines.push('', '  Suggestions:');
            funnel.suggestions.forEach((s) => lines.push(`    • ${s}`));
        }
        lines.push('', '── MRR GROWTH PLAN ─────────────────────────', `  Current: $${mrrPlan.currentMRR}  →  Target: $${mrrPlan.targetMRR}  (Gap: $${mrrPlan.gap})`, `  ${mrrPlan.summary}`, '', '  Steps:');
        mrrPlan.steps.forEach((s) => {
            lines.push(`    ${s.step}. [${s.lever}] ${s.action} → ${s.expectedImpact}`);
        });
        lines.push('', '════════════════════════════════════════════');
        return lines.join('\n');
    }
}
exports.MonetizationIntelligence = MonetizationIntelligence;
