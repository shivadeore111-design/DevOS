// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personality/userProfile.ts — Persistent user profile and preferences

import * as fs   from 'fs'
import * as path from 'path'

const PROFILE_FILE = path.join(process.cwd(), 'workspace', 'user-profile.json')

export interface UserProfile {
  name?:           string
  preferredStack?: string       // e.g. "TypeScript + Node.js"
  primaryGoal?:    string       // e.g. "Build a SaaS product"
  experience?:     'beginner' | 'intermediate' | 'expert'
  pilotsEnabled:   boolean
  onboardingDone:  boolean
  firstSeenAt:     string
  lastSeenAt:      string
  totalGoals:      number
  recentGoalTypes: string[]     // last 10 goal types
}

const DEFAULT_PROFILE: UserProfile = {
  pilotsEnabled:   false,
  onboardingDone:  false,
  firstSeenAt:     new Date().toISOString(),
  lastSeenAt:      new Date().toISOString(),
  totalGoals:      0,
  recentGoalTypes: [],
}

class UserProfileManager {

  loadProfile(): UserProfile {
    try {
      if (fs.existsSync(PROFILE_FILE)) {
        const raw = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf-8')) as Partial<UserProfile>
        return { ...DEFAULT_PROFILE, ...raw }
      }
    } catch { /* corrupt — rebuild */ }
    return { ...DEFAULT_PROFILE }
  }

  saveProfile(profile: UserProfile): void {
    const dir = path.dirname(PROFILE_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2))
  }

  isFirstRun(): boolean {
    return !this.loadProfile().onboardingDone
  }

  updateLastSeen(): void {
    const profile = this.loadProfile()
    profile.lastSeenAt = new Date().toISOString()
    this.saveProfile(profile)
  }

  /** Record a completed goal — updates totalGoals + recentGoalTypes */
  learnFromGoal(goalType: string): void {
    const profile = this.loadProfile()
    profile.totalGoals += 1
    profile.recentGoalTypes = [...profile.recentGoalTypes, goalType].slice(-10)
    this.saveProfile(profile)
  }

  patch(updates: Partial<UserProfile>): UserProfile {
    const profile = { ...this.loadProfile(), ...updates }
    this.saveProfile(profile)
    return profile
  }

  reset(): void {
    if (fs.existsSync(PROFILE_FILE)) fs.unlinkSync(PROFILE_FILE)
  }
}

export const userProfile = new UserProfileManager()
