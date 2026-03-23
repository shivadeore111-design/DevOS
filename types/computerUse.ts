export type ActionType =
  | 'click' | 'type' | 'scroll' | 'keypress' | 'screenshot' | 'api_call'

export interface BaseAction {
  id: string
  type: ActionType
  description?: string
  confidence: number        // 0–1 from LLM
  fallback?: ComputerUseAction
  retries?: number
  timeoutMs?: number
}

export interface ClickAction extends BaseAction { type:'click'; x:number; y:number; button?:'left'|'right' }
export interface TypeAction extends BaseAction { type:'type'; text:string; delayMs?:number }
export interface ScrollAction extends BaseAction { type:'scroll'; deltaX?:number; deltaY?:number }
export interface KeypressAction extends BaseAction { type:'keypress'; keys:string[] }
export interface ScreenshotAction extends BaseAction { type:'screenshot'; savePath?:string }
export interface ApiCallAction extends BaseAction {
  type:'api_call'; service:string; endpoint:string
  method:'GET'|'POST'|'PUT'|'DELETE'; payload?:any; headers?:Record<string,string>
}

export type ComputerUseAction =
  | ClickAction | TypeAction | ScrollAction | KeypressAction | ScreenshotAction | ApiCallAction

export interface VisionLoopResult {
  success: boolean
  iterations: number
  actionsExecuted: ComputerUseAction[]
  failureReason?: string
}
