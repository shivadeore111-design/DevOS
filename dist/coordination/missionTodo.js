"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.missionTodo = void 0;
// coordination/missionTodo.ts — Mission progress as a markdown TODO file
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class MissionTodo {
    todoPath(missionId) {
        return path.join(process.cwd(), 'workspace', 'missions', missionId, 'todo.md');
    }
    createTodo(missionId, goal, tasks) {
        const dir = path.dirname(this.todoPath(missionId));
        fs.mkdirSync(dir, { recursive: true });
        const taskLines = tasks
            .map(t => `- [${t.done ? 'x' : ' '}] [${t.agent}] ${t.title}`)
            .join('\n');
        const content = `# Mission: ${goal}\n## Tasks\n${taskLines}\n`;
        fs.writeFileSync(this.todoPath(missionId), content, 'utf-8');
    }
    tickTask(missionId, taskTitle) {
        const filePath = this.todoPath(missionId);
        if (!fs.existsSync(filePath))
            return;
        const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
        const updated = lines.map(line => {
            if (line.includes(`] ${taskTitle}`) && line.includes('[ ]')) {
                return line.replace('[ ]', '[x]');
            }
            return line;
        });
        fs.writeFileSync(filePath, updated.join('\n'), 'utf-8');
    }
    readTodo(missionId) {
        const filePath = this.todoPath(missionId);
        if (!fs.existsSync(filePath))
            return '';
        return fs.readFileSync(filePath, 'utf-8');
    }
    getProgress(missionId) {
        const content = this.readTodo(missionId);
        const done = (content.match(/\[x\]/g) ?? []).length;
        const total = done + (content.match(/\[ \]/g) ?? []).length;
        return { total, done };
    }
}
exports.missionTodo = new MissionTodo();
