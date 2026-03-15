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
exports.writeFile = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.writeFile = {
    name: "writeFile",
    description: "Write or append content to a file, creating parent directories as needed",
    async execute(input) {
        try {
            const fullPath = path.resolve(input.path);
            const dir = path.dirname(fullPath);
            fs.mkdirSync(dir, { recursive: true });
            if (input.append) {
                fs.appendFileSync(fullPath, input.content, "utf-8");
            }
            else {
                fs.writeFileSync(fullPath, input.content, "utf-8");
            }
            return {
                success: true,
                output: { path: fullPath, bytes: input.content.length },
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    },
};
