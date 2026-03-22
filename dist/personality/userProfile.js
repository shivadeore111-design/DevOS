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
exports.userProfile = void 0;
// personality/userProfile.ts — Persistent user profile and preferences
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const PROFILE_FILE = path.join(process.cwd(), 'workspace', 'user-profile.json');
const DEFAULT_PROFILE = {
    pilotsEnabled: false,
    onboardingDone: false,
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    totalGoals: 0,
    recentGoalTypes: [],
};
class UserProfileManager {
    loadProfile() {
        try {
            if (fs.existsSync(PROFILE_FILE)) {
                const raw = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf-8'));
                return { ...DEFAULT_PROFILE, ...raw };
            }
        }
        catch { /* corrupt — rebuild */ }
        return { ...DEFAULT_PROFILE };
    }
    saveProfile(profile) {
        const dir = path.dirname(PROFILE_FILE);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2));
    }
    isFirstRun() {
        return !this.loadProfile().onboardingDone;
    }
    updateLastSeen() {
        const profile = this.loadProfile();
        profile.lastSeenAt = new Date().toISOString();
        this.saveProfile(profile);
    }
    /** Record a completed goal — updates totalGoals + recentGoalTypes */
    learnFromGoal(goalType) {
        const profile = this.loadProfile();
        profile.totalGoals += 1;
        profile.recentGoalTypes = [...profile.recentGoalTypes, goalType].slice(-10);
        this.saveProfile(profile);
    }
    patch(updates) {
        const profile = { ...this.loadProfile(), ...updates };
        this.saveProfile(profile);
        return profile;
    }
    reset() {
        if (fs.existsSync(PROFILE_FILE))
            fs.unlinkSync(PROFILE_FILE);
    }
}
exports.userProfile = new UserProfileManager();
