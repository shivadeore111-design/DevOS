"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.liveThinking = void 0;
// coordination/liveThinking.ts — Streams agent reasoning to UI via SSE
const eventBus_1 = require("../core/eventBus");
class LiveThinking {
    emit(event) {
        eventBus_1.eventBus.emit('agent_thinking', event);
    }
    think(agent, message, missionId) {
        this.emit({ type: 'thinking', agent, message, timestamp: new Date().toISOString(), missionId });
    }
    act(agent, message, missionId) {
        this.emit({ type: 'acting', agent, message, timestamp: new Date().toISOString(), missionId });
    }
    done(agent, message, missionId) {
        this.emit({ type: 'done', agent, message, timestamp: new Date().toISOString(), missionId });
    }
    error(agent, message, missionId) {
        this.emit({ type: 'error', agent, message, timestamp: new Date().toISOString(), missionId });
    }
}
exports.liveThinking = new LiveThinking();
