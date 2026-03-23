import { ComputerUseAction } from './computerUse'

export type ExecutorStatus = 'success' | 'failed' | 'fallback' | 'skipped' | 'retried'

export type ExecutorErrorType =
  | 'API_ERROR'
  | 'UI_ERROR'
  | 'SCREEN_ERROR'
  | 'TIMEOUT'
  | 'VALIDATION_ERROR'
  | 'CONFIDENCE_TOO_LOW'
  | 'REJECTED_BY_USER'
  | 'UNKNOWN'

export interface ExecutorError {
  type: ExecutorErrorType
  message: string
  retryable: boolean
  repairSuggestion?: string  // from FaultEngine
}

export interface ExecutorResult {
  actionId: string
  status: ExecutorStatus
  data?: any
  error?: ExecutorError
  durationMs: number
  retriesUsed: number
  usedFallback: boolean
  verifiedByTruthCheck: boolean
}

export interface ExecutorSession {
  sessionId: string
  goal: string
  startedAt: string
  results: ExecutorResult[]
  totalDurationMs: number
  successRate: number
}
