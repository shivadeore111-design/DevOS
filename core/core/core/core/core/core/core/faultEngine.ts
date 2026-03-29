// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/faultEngine.ts — Error classification and repair strategy engine.
// Classifies runtime errors into typed categories and provides repair
// suggestions for automated recovery or user guidance.

export type ErrorType =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'AUTH'
  | 'NOT_FOUND'
  | 'PERMISSION'
  | 'VALIDATION'
  | 'SCREEN_CHANGE'
  | 'DOCKER'
  | 'LLM'
  | 'UNKNOWN'

export interface FaultClassification {
  errorType:       ErrorType
  message:         string
  retryable:       boolean
  /** Short automated repair command or suggestion */
  repairCommand?:  string
  /** Human-readable fix description */
  manualFix?:      string
  severity:        'low' | 'medium' | 'high' | 'critical'
}

export interface FaultContext {
  actionType?:    string
  workspacePath?: string
  taskId?:        string
  [key: string]:  any
}

// ── Classification rules ───────────────────────────────────────

const RULES: Array<{
  test:          (msg: string) => boolean
  errorType:     ErrorType
  retryable:     boolean
  severity:      FaultClassification['severity']
  repairCommand?: string
  manualFix?:     string
}> = [
  {
    test:          m => /timeout|timed out/i.test(m),
    errorType:     'TIMEOUT',
    retryable:     true,
    severity:      'medium',
    repairCommand: 'retry with longer timeoutMs',
    manualFix:     'Increase timeoutMs in action options or check network latency.',
  },
  {
    test:          m => /ECONNREFUSED|ENOTFOUND|network|fetch/i.test(m),
    errorType:     'NETWORK',
    retryable:     true,
    severity:      'medium',
    repairCommand: 'check network connectivity',
    manualFix:     'Verify the target host is reachable. Check DEVOS_API_URL env var.',
  },
  {
    test:          m => /401|403|unauthorized|forbidden|auth/i.test(m),
    errorType:     'AUTH',
    retryable:     false,
    severity:      'high',
    repairCommand: 'refresh credentials',
    manualFix:     'API key or token may be expired. Refresh in config/api-keys.json.',
  },
  {
    test:          m => /404|not found|no such/i.test(m),
    errorType:     'NOT_FOUND',
    retryable:     false,
    severity:      'medium',
    repairCommand: 'verify resource path',
    manualFix:     'The resource was not found. Check the endpoint or file path.',
  },
  {
    test:          m => /permission|access denied|EACCES/i.test(m),
    errorType:     'PERMISSION',
    retryable:     false,
    severity:      'high',
    repairCommand: 'check file/API permissions',
    manualFix:     'Permission denied. Check file ownership or API scope.',
  },
  {
    test:          m => /selector|element|click|visible change|no visible/i.test(m),
    errorType:     'SCREEN_CHANGE',
    retryable:     true,
    severity:      'medium',
    repairCommand: 'retry action with longer wait',
    manualFix:     'Screen element not found or did not change. The UI may have changed.',
  },
  {
    test:          m => /docker|container|vault/i.test(m),
    errorType:     'DOCKER',
    retryable:     true,
    severity:      'high',
    repairCommand: 'docker info && docker ps',
    manualFix:     'Docker daemon may not be running. Run: docker info',
  },
  {
    test:          m => /ollama|llm|model|llava/i.test(m),
    errorType:     'LLM',
    retryable:     true,
    severity:      'medium',
    repairCommand: 'ollama serve',
    manualFix:     'LLM unavailable. Ensure Ollama is running: ollama serve',
  },
]

// ── FaultEngine class ─────────────────────────────────────────

class FaultEngine {
  /**
   * Classify an error message and return repair strategies.
   * Context is optional metadata (e.g. actionType, workspacePath).
   * Can be called with 1 or 2 arguments.
   */
  classify(message: string, context?: FaultContext): FaultClassification {
    const msg = message ?? ''

    for (const rule of RULES) {
      if (rule.test(msg)) {
        return {
          errorType:     rule.errorType,
          message:       msg,
          retryable:     rule.retryable,
          severity:      rule.severity,
          repairCommand: rule.repairCommand,
          manualFix:     rule.manualFix,
        }
      }
    }

    return {
      errorType:    'UNKNOWN',
      message:      msg,
      retryable:    false,
      severity:     'medium',
      repairCommand: undefined,
      manualFix:    'An unexpected error occurred. Check the DevOS logs for details.',
    }
  }
}

export const faultEngine = new FaultEngine()
