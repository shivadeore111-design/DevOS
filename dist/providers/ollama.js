"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ollamaProvider = void 0;
const modelDiscovery_1 = require("../core/modelDiscovery");
exports.ollamaProvider = {
    name: 'ollama',
    async generate(messages, model) {
        const res = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, stream: false, messages }),
            signal: AbortSignal.timeout((0, modelDiscovery_1.getOllamaTimeout)(model || '')),
        });
        const data = await res.json();
        return data?.message?.content || '';
    },
    async generateStream(messages, model, onToken) {
        const res = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, stream: true, messages }),
            signal: AbortSignal.timeout((0, modelDiscovery_1.getOllamaTimeout)(model || '')),
        });
        if (!res.body)
            return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() ?? '';
            for (const line of lines) {
                if (!line.trim())
                    continue;
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.message?.content)
                        onToken(parsed.message.content);
                }
                catch { /* skip malformed */ }
            }
        }
        // flush remaining
        if (buf.trim()) {
            try {
                const parsed = JSON.parse(buf);
                if (parsed.message?.content)
                    onToken(parsed.message.content);
            }
            catch { }
        }
    },
    async listModels() {
        try {
            const res = await fetch('http://localhost:11434/api/tags');
            const data = await res.json();
            return data.models?.map((m) => m.name) || [];
        }
        catch {
            return [];
        }
    },
};
