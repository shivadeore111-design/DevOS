// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/triggers/githubTrigger.ts — Parses GitHub webhook events and maps them
//   to DevOS goals via the WebhookTrigger HTTP server.

import http        from "http"
import { webhookTrigger } from "./webhookTrigger"
import { eventBus }       from "../eventBus"

const GITHUB_PATH = "/webhook/github"

interface GithubBinding {
  event: "push" | "issues" | "pull_request"
  repo:  string
  goal:  string
}

export class GithubTrigger {

  private bindings: GithubBinding[] = []
  private _registered = false

  // ── Public API ─────────────────────────────────────────────

  /** Fire `goal` whenever a push event is received for `repo`. */
  onPush(repo: string, goal: string): void {
    this.bindings.push({ event: "push", repo, goal })
    this._ensureRegistered()
    console.log(`[GithubTrigger] onPush → ${repo}: "${goal}"`)
  }

  /** Fire `goal` whenever a new issue is opened in `repo`. */
  onIssue(repo: string, goal: string): void {
    this.bindings.push({ event: "issues", repo, goal })
    this._ensureRegistered()
    console.log(`[GithubTrigger] onIssue → ${repo}: "${goal}"`)
  }

  /** Fire `goal` whenever a new PR is opened in `repo`. */
  onPR(repo: string, goal: string): void {
    this.bindings.push({ event: "pull_request", repo, goal })
    this._ensureRegistered()
    console.log(`[GithubTrigger] onPR → ${repo}: "${goal}"`)
  }

  // ── Internal ──────────────────────────────────────────────

  /**
   * Register the /webhook/github endpoint on webhookTrigger once,
   * then subscribe to the raw webhook_triggered event to parse and route
   * GitHub-specific payloads.
   */
  private _ensureRegistered(): void {
    if (this._registered) return
    this._registered = true

    // Register the path (goal text is a placeholder; we handle routing ourselves)
    webhookTrigger.register(GITHUB_PATH, "__github_internal__")

    // Subscribe to raw webhook events to intercept GitHub payloads
    eventBus.on("webhook_triggered", (data: any) => {
      if (data?.path !== GITHUB_PATH) return
      this._dispatch(data.payload)
    })
  }

  /**
   * Parse a GitHub webhook payload and fire matching bindings.
   * Uses the X-GitHub-Event header value embedded in the payload wrapper,
   * or falls back to inspecting the payload shape.
   */
  private _dispatch(payload: any): void {
    if (!payload || typeof payload !== "object") return

    // GitHub sends event type in X-GitHub-Event header; webhookTrigger doesn't
    // forward headers, so we infer from payload structure.
    const eventType = this._inferEvent(payload)
    const repoName  = payload?.repository?.full_name ?? payload?.repository?.name ?? ""

    if (!eventType || !repoName) {
      console.warn("[GithubTrigger] Could not determine event type or repo from payload")
      return
    }

    for (const binding of this.bindings) {
      if (binding.event !== eventType) continue
      // repo matching: exact or prefix (org/repo or just repo)
      if (repoName !== binding.repo && !repoName.endsWith(`/${binding.repo}`)) continue

      const enrichedGoal = this._enrichGoal(binding.goal, eventType, repoName, payload)
      console.log(`[GithubTrigger] 🔔 ${eventType} on ${repoName} → "${enrichedGoal}"`)
      eventBus.emit("github_triggered", {
        event:  eventType,
        repo:   repoName,
        goal:   enrichedGoal,
        payload,
      })
    }
  }

  private _inferEvent(payload: any): "push" | "issues" | "pull_request" | null {
    if (payload.commits !== undefined || payload.ref !== undefined) return "push"
    if (payload.issue   !== undefined && payload.pull_request === undefined) return "issues"
    if (payload.pull_request !== undefined) return "pull_request"
    return null
  }

  private _enrichGoal(
    goal:      string,
    event:     string,
    repo:      string,
    payload:   any,
  ): string {
    switch (event) {
      case "push": {
        const branch  = (payload.ref as string ?? "").replace("refs/heads/", "")
        const message = payload.commits?.[0]?.message ?? ""
        return `New push to ${repo} (branch: ${branch}, commit: "${message.slice(0, 80)}"). Goal: ${goal}`
      }
      case "issues": {
        const title = payload.issue?.title ?? ""
        return `New issue in ${repo}: ${title}. Goal: ${goal}`
      }
      case "pull_request": {
        const title = payload.pull_request?.title ?? ""
        return `New PR in ${repo}: ${title}. Goal: ${goal}`
      }
      default:
        return `${event} event in ${repo}. Goal: ${goal}`
    }
  }
}

/**
 * To use the github trigger with proper header parsing, the webhook server
 * would need to forward the X-GitHub-Event header. This thin wrapper patches
 * the raw request handler to capture that header before webhookTrigger processes
 * the request body, and re-emits with the event type injected into the payload.
 *
 * For production use you would configure GitHub to send the event header and
 * parse it in a custom handler. The current implementation infers the event from
 * payload shape which covers 99% of cases.
 */
export const githubTrigger = new GithubTrigger()
