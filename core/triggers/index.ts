// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

export { cronTrigger }    from "./cronTrigger"
export { webhookTrigger } from "./webhookTrigger"
export { githubTrigger }  from "./githubTrigger"

import { cronTrigger }    from "./cronTrigger"
import { webhookTrigger } from "./webhookTrigger"

export function startAllTriggers(webhookPort?: number): void {
  cronTrigger.start()
  webhookTrigger.start(webhookPort)
  console.log("[Triggers] All triggers started")
}

export function stopAllTriggers(): void {
  cronTrigger.stop()
  webhookTrigger.stop()
  console.log("[Triggers] All triggers stopped")
}
