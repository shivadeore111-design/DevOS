"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrowthEngine = void 0;
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const router_1 = require("../llm/router");
const WORKSPACE_PATH = path_1.default.join(process.cwd(), "workspace", "growth");
// ── Helpers ──────────────────────────────────────────────────
function ensureFolder() {
    fs_1.default.mkdirSync(WORKSPACE_PATH, { recursive: true });
}
function saveFile(filename, content) {
    ensureFolder();
    const filepath = path_1.default.join(WORKSPACE_PATH, filename);
    fs_1.default.writeFileSync(filepath, content, "utf-8");
    console.log(`[GrowthEngine] Saved → ${filepath}`);
}
function isDefaultOutput(value) {
    const defaults = ["your product headline", "unknown", "b2b saas buyers", ""];
    return defaults.some((d) => value?.toLowerCase().trim() === d.toLowerCase());
}
function formatICPMarkdown(icp) {
    return `# Ideal Customer Profile

**Segment:** ${icp.segment}
**Company Size:** ${icp.companySize}
**Messaging Angle:** ${icp.messagingAngle}

## Job Titles
${icp.jobTitles.map((t) => `- ${t}`).join("\n")}

## Pain Points
${icp.painPoints.map((p) => `- ${p}`).join("\n")}

## Goals
${icp.goals.map((g) => `- ${g}`).join("\n")}

## Objections
${icp.objections.map((o) => `- ${o}`).join("\n")}

## Trigger Events
${icp.triggerEvents.map((e) => `- ${e}`).join("\n")}
`;
}
function formatLandingMarkdown(landing) {
    const valueProps = landing.valueProps
        .map((v) => `### ${v.title}\n${v.description}`)
        .join("\n\n");
    const faq = landing.faq
        .map((f) => `**Q: ${f.question}**\nA: ${f.answer}`)
        .join("\n\n");
    return `# Landing Page Copy

## Headline
${landing.headline}

## Subheadline
${landing.subheadline}

## Hero
${landing.hero}

## Value Propositions
${valueProps}

## FAQ
${faq}

## CTA
${landing.cta}
*${landing.ctaSubtext}*

## SEO
**Title:** ${landing.seoTitle}
**Description:** ${landing.seoDescription}
`;
}
function formatEmailMarkdown(name, emails) {
    const items = emails.map((e) => `
---
## Day ${e.dayOffset} — ${e.subject}
**Preview:** ${e.previewText}

${e.body}

**CTA:** [${e.cta}](${e.ctaUrl})
`).join("\n");
    return `# Email Sequence: ${name}\n${items}`;
}
// ── GrowthEngine ─────────────────────────────────────────────
class GrowthEngine {
    static async generateICP(productDescription) {
        const fallback = {
            segment: "unknown", jobTitles: [], companySize: "",
            painPoints: [], goals: [], objections: [],
            triggerEvents: [], messagingAngle: "",
        };
        const icp = await (0, router_1.llmCallJSON)(`Generate an Ideal Customer Profile for this product: ${productDescription}

Return this exact JSON:
{
  "segment": "short segment name",
  "jobTitles": ["Title 1", "Title 2"],
  "companySize": "e.g. 1-10 employees",
  "painPoints": ["pain 1", "pain 2", "pain 3"],
  "goals": ["goal 1", "goal 2"],
  "objections": ["objection 1", "objection 2"],
  "triggerEvents": ["event 1", "event 2"],
  "messagingAngle": "one sentence positioning statement"
}`, "You are a SaaS growth strategist. Return ONLY valid JSON. No explanation.", fallback);
        if (isDefaultOutput(icp.segment)) {
            console.warn("[GrowthEngine] ⚠️ ICP quality low — model may need stronger prompt");
        }
        saveFile("icp.md", formatICPMarkdown(icp));
        return icp;
    }
    static async generateLandingPageCopy(icp, productDescription) {
        const fallback = {
            headline: "", subheadline: "", hero: "", valueProps: [],
            faq: [], cta: "Get Started Free", ctaSubtext: "No credit card required",
            seoTitle: "", seoDescription: "",
        };
        const landing = await (0, router_1.llmCallJSON)(`Write landing page copy for this SaaS product.

Product: ${productDescription}
Target Customer: ${icp.segment} — ${icp.messagingAngle}
Pain Points: ${icp.painPoints.slice(0, 3).join(", ")}

Return this exact JSON:
{
  "headline": "compelling headline under 10 words",
  "subheadline": "one sentence value proposition",
  "hero": "2-3 sentence hero section copy",
  "valueProps": [
    {"title": "Feature Name", "description": "Benefit description"},
    {"title": "Feature Name", "description": "Benefit description"},
    {"title": "Feature Name", "description": "Benefit description"}
  ],
  "faq": [
    {"question": "Common question?", "answer": "Clear answer."},
    {"question": "Common question?", "answer": "Clear answer."}
  ],
  "cta": "CTA button text",
  "ctaSubtext": "reassurance text under button",
  "seoTitle": "SEO page title",
  "seoDescription": "SEO meta description under 160 chars"
}`, "You are a SaaS conversion copywriter. Return ONLY valid JSON. No explanation.", fallback);
        if (isDefaultOutput(landing.headline)) {
            console.warn("[GrowthEngine] ⚠️ Landing headline low quality — applying fallback template");
            landing.headline = `The Smartest Way to ${icp.painPoints[0] ?? "Grow Your Business"}`;
        }
        saveFile("landing-page.md", formatLandingMarkdown(landing));
        return landing;
    }
    static async generateEmailSequence(name, trigger, icp) {
        const fallback = [];
        const emails = await (0, router_1.llmCallJSON)(`Create a 6-email drip sequence for a SaaS product.

Sequence: ${name}
Trigger: ${trigger}
Customer: ${icp.segment} — ${icp.messagingAngle}
Pain Points: ${icp.painPoints.slice(0, 3).join(", ")}

Return a JSON array with exactly 6 emails:
[
  {
    "dayOffset": 0,
    "subject": "Email subject line",
    "previewText": "Preview text under 90 chars",
    "body": "2-3 paragraph email body",
    "cta": "CTA button text",
    "ctaUrl": "{{CTA_URL}}"
  }
]

Day offsets must be: 0, 1, 3, 5, 7, 10`, "You are an email conversion strategist for SaaS. Return ONLY a valid JSON array. No explanation.", fallback);
        saveFile(`email-sequence-${name.toLowerCase()}.md`, formatEmailMarkdown(name, emails));
        return emails;
    }
    static async generateContentCalendar(weeks, icp) {
        const fallback = [];
        const items = await (0, router_1.llmCallJSON)(`Create a ${weeks}-week content calendar for a SaaS targeting ${icp.segment}.

Pain Points: ${icp.painPoints.slice(0, 3).join(", ")}

Return a JSON array:
[
  {
    "week": 1,
    "platform": "Twitter",
    "type": "Thread",
    "topic": "specific topic",
    "angle": "specific angle or hook"
  }
]

Include variety: Twitter threads, LinkedIn posts, blog posts. At least 3 items per week.`, "You are a SaaS content strategist. Return ONLY a valid JSON array. No explanation.", fallback);
        const table = [
            "# 4-Week Content Calendar\n",
            "| Week | Platform | Type | Topic | Angle |",
            "|------|----------|------|-------|-------|",
            ...items.map((i) => `| ${i.week} | ${i.platform} | ${i.type} | ${i.topic} | ${i.angle} |`),
        ].join("\n");
        saveFile(`content-calendar-${weeks}w.md`, table);
        return items;
    }
    static async generateTwitterThread(topic, angle) {
        const response = await (0, router_1.llmCall)(`Write a 7-tweet Twitter thread about: ${topic}
Angle: ${angle}

Format:
Tweet 1 (hook): [attention-grabbing opener]
Tweet 2: [key point]
...
Tweet 7 (CTA): [call to action]

Rules: each tweet under 280 chars, no hashtag spam, hook must stop the scroll.`, "You are a viral SaaS content creator on Twitter. Write punchy, value-packed threads.");
        const tweets = response.content
            .split(/Tweet \d+[^:]*:/i)
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
        const filename = `twitter-thread-${Date.now()}.md`;
        saveFile(filename, `# Twitter Thread: ${topic}\n\n` + tweets.map((t, i) => `**Tweet ${i + 1}:**\n${t}`).join("\n\n"));
        return tweets;
    }
    static async generateLinkedInPost(topic, icp) {
        const response = await (0, router_1.llmCall)(`Write a LinkedIn post about: ${topic}
Target audience: ${icp.segment}
Angle: ${icp.messagingAngle}

Rules:
- Hook in first line (no "I am excited to share")
- 150-300 words
- End with a question to drive comments
- Professional but human tone`, "You are a SaaS founder writing authentic LinkedIn content. No corporate jargon.");
        saveFile(`linkedin-${Date.now()}.md`, `# LinkedIn Post: ${topic}\n\n${response.content}`);
        return response.content;
    }
}
exports.GrowthEngine = GrowthEngine;
