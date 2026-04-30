// Detects whether a user message expresses an action intent (vs. a question or
// conversational turn). Used by the PlannerGuard to reject respond-only plans
// that were generated in response to clear action requests.
//
// Anchored at start of message, allows optional polite prefixes and leading
// whitespace. Add new verbs here — keep sorted for readability.

const ACTION_VERB_RE =
  /^\s*(?:please\s+|can\s+you\s+|could\s+you\s+)?(append|capture|close|copy|delete|download|edit|execute|fetch|get|kill|launch|lock|move|mute|open|pause|play|prepend|read|reboot|record|remind|remove|rename|replace|restart|resume|run|save|schedule|screenshot|send|set\s+timer|shutdown|skip|speak|start|stop|transcribe|unlock|unmute|upload|volume|write)\b/i

export function isActionIntent(message: string): boolean {
  return ACTION_VERB_RE.test(message)
}

export function detectActionVerb(message: string): string {
  const m = message.match(ACTION_VERB_RE)
  return m ? m[1].replace(/\s+/g, ' ').toLowerCase() : ''
}

/*
 * Unit assertions (run manually: npx tsx core/actionVerbDetector.ts)
 *
 * Expect true:
 *   isActionIntent('open notepad')              // bare verb
 *   isActionIntent('please open notepad')       // polite prefix
 *   isActionIntent('can you launch chrome')     // can you
 *   isActionIntent('could you mute')            // could you
 *   isActionIntent('screenshot')                // single word
 *   isActionIntent('set timer for 5 minutes')   // two-word verb
 *   isActionIntent('  volume up')               // leading whitespace
 *   isActionIntent('Close all windows')         // capitalised
 *
 * Expect false:
 *   isActionIntent('what can you do')           // question — no action verb at start
 *   isActionIntent("what's 2+2")                // math question
 *   isActionIntent('tell me about open source') // 'open' not at intent position
 *   isActionIntent('how do I start a project')  // 'start' after 'how do I'
 *   isActionIntent('')                          // empty
 */
