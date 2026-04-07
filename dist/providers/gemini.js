"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGeminiProvider = createGeminiProvider;
function createGeminiProvider(apiKey) {
    return {
        name: 'gemini',
        async generateWithTools(messages, model, tools) {
            const geminiModel = model || 'gemini-1.5-flash';
            const contents = messages
                .filter(m => m.role !== 'system')
                .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            }));
            const system = messages.find(m => m.role === 'system')?.content;
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents,
                    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
                    tools: [{
                            functionDeclarations: tools.map(t => ({
                                name: t.name,
                                description: t.description,
                                parameters: t.parameters,
                            })),
                        }],
                }),
            });
            const data = await res.json();
            if (!res.ok)
                throw new Error(`${res.status}: ${JSON.stringify(data)}`);
            const candidate = data.candidates?.[0]?.content;
            const toolCalls = [];
            let content = '';
            for (const part of candidate?.parts || []) {
                if (part.text)
                    content += part.text;
                if (part.functionCall)
                    toolCalls.push({
                        name: part.functionCall.name,
                        arguments: part.functionCall.args || {},
                    });
            }
            return { content, toolCalls };
        },
        async generate(messages, model) {
            const geminiModel = model || 'gemini-1.5-flash';
            const contents = messages
                .filter(m => m.role !== 'system')
                .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            }));
            const system = messages.find(m => m.role === 'system')?.content;
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents,
                    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
                }),
            });
            if (!res.ok) {
                const err = await res.text();
                throw new Error(`${res.status}: ${err}`);
            }
            const data = await res.json();
            return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        },
        async generateStream(messages, model, onToken) {
            // Gemini streaming — generate full response and emit as single token
            const result = await this.generate(messages, model);
            onToken(result);
        },
    };
}
