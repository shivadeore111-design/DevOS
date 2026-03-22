"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.backgroundAgents = exports.BackgroundAgents = void 0;
// personal/backgroundAgents.ts — Background agent configs registered as pilots
const pilotRegistry_1 = require("../devos/pilots/pilotRegistry");
const AGENT_CONFIGS = {
    'startup-scout': {
        id: 'startup-scout',
        name: 'Startup Scout',
        description: 'Daily scan of GitHub trending, ProductHunt, and IndieHackers',
        version: '1.0.0',
        schedule: '0 8 * * *',
        triggerOnStart: false,
        systemPrompt: 'Research GitHub trending repositories today, ProductHunt top products, and IndieHackers trending. Summarise the top 5 most interesting findings in bullet points.',
        tools: ['web_search', 'web_fetch', 'file_write'],
        memoryKey: 'startup-scout',
        maxIterations: 10,
        outputFormat: 'file',
        outputPath: 'workspace/reports/startup-scout-{date}.md',
        enabled: false,
    },
    'market-monitor': {
        id: 'market-monitor',
        name: 'Market Monitor',
        description: 'Every 30 minutes market and crypto news scan',
        version: '1.0.0',
        schedule: '*/30 * * * *',
        triggerOnStart: false,
        systemPrompt: 'Search for significant market news and crypto price movements in the last 30 minutes. Only report if something significant happened (>5% moves, major news). Otherwise output: "No significant activity".',
        tools: ['web_search', 'web_fetch'],
        memoryKey: 'market-monitor',
        maxIterations: 5,
        outputFormat: 'file',
        outputPath: 'workspace/reports/market-{date}.md',
        enabled: false,
    },
    'ai-researcher': {
        id: 'ai-researcher',
        name: 'AI Researcher',
        description: 'Daily scan of new AI tools and research papers',
        version: '1.0.0',
        schedule: '0 9 * * *',
        triggerOnStart: false,
        systemPrompt: 'Research new AI tools released this week and notable AI research papers on arxiv today. Summarise the top 5 most relevant findings for a software developer building AI products.',
        tools: ['web_search', 'web_fetch', 'file_write'],
        memoryKey: 'ai-researcher',
        maxIterations: 10,
        outputFormat: 'file',
        outputPath: 'workspace/reports/ai-research-{date}.md',
        enabled: false,
    },
    'competitor-tracker': {
        id: 'competitor-tracker',
        name: 'Competitor Tracker',
        description: 'Daily check of competitor websites for changes',
        version: '1.0.0',
        schedule: '0 12 * * *',
        triggerOnStart: false,
        systemPrompt: 'Check workspace/competitors.json for competitor URLs. Fetch each URL and compare with stored version in workspace/competitor-snapshots/. Report any significant changes in pricing, features, or messaging.',
        tools: ['web_fetch', 'file_read', 'file_write'],
        memoryKey: 'competitor-tracker',
        maxIterations: 10,
        outputFormat: 'file',
        outputPath: 'workspace/reports/competitors-{date}.md',
        enabled: false,
    },
};
class BackgroundAgents {
    async enableAgent(name) {
        const config = AGENT_CONFIGS[name];
        if (!config)
            throw new Error('Unknown agent: ' + name);
        config.enabled = true;
        pilotRegistry_1.pilotRegistry.register(config);
        console.log(`[BackgroundAgents] ✅ Enabled: ${name}`);
    }
    async disableAgent(name) {
        pilotRegistry_1.pilotRegistry.disable(name);
        console.log(`[BackgroundAgents] ⏹ Disabled: ${name}`);
    }
    listAgents() {
        return Object.entries(AGENT_CONFIGS).map(([name, config]) => {
            const pilot = pilotRegistry_1.pilotRegistry.get(name);
            return {
                name,
                status: pilot?.enabled ? 'enabled' : 'disabled',
                schedule: config.schedule ?? '(no schedule)',
            };
        });
    }
    getAgentStatus(name) {
        const pilot = pilotRegistry_1.pilotRegistry.get(name);
        return pilot?.enabled ? 'enabled' : 'disabled';
    }
}
exports.BackgroundAgents = BackgroundAgents;
exports.backgroundAgents = new BackgroundAgents();
