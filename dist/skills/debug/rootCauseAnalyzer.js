"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RootCauseAnalyzer = void 0;
class RootCauseAnalyzer {
    constructor(baseUrl = "http://localhost:11434") {
        this.baseUrl = baseUrl;
    }
    async analyze(logAnalysis, stackTrace) {
        const prompt = this.createPrompt(logAnalysis, stackTrace);
        const response = await fetch(`${this.baseUrl}/api/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3.2",
                stream: false,
                prompt
            })
        });
        if (!response.ok) {
            throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
        }
        const data = (await response.json());
        return this.parseResult(data.response);
    }
    createPrompt(logAnalysis, stackTrace) {
        return [
            "You are a senior debugging assistant.",
            "Given an error analysis and stack trace, identify root cause and a concrete fix.",
            "Respond ONLY in JSON with keys: rootCause, fix, confidence (high|medium|low), affectedFile.",
            "Error Analysis:",
            JSON.stringify(logAnalysis, null, 2),
            "Stack Trace:",
            stackTrace,
            "Return strict JSON only."
        ].join("\n");
    }
    parseResult(raw) {
        if (!raw) {
            return {
                rootCause: "Model returned no response.",
                fix: "Re-run with additional stack trace context.",
                confidence: "low"
            };
        }
        const jsonBlockMatch = raw.match(/\{[\s\S]*\}/);
        const candidate = jsonBlockMatch ? jsonBlockMatch[0] : raw;
        try {
            const parsed = JSON.parse(candidate);
            return {
                rootCause: parsed.rootCause?.trim() || "Unable to determine exact root cause.",
                fix: parsed.fix?.trim() || "Inspect recent code changes near the reported stack frame.",
                confidence: this.normalizeConfidence(parsed.confidence),
                affectedFile: parsed.affectedFile?.trim() || undefined
            };
        }
        catch {
            return {
                rootCause: "Failed to parse model response.",
                fix: raw.trim(),
                confidence: "low"
            };
        }
    }
    normalizeConfidence(confidence) {
        if (confidence === "high" || confidence === "medium" || confidence === "low") {
            return confidence;
        }
        return "low";
    }
}
exports.RootCauseAnalyzer = RootCauseAnalyzer;
