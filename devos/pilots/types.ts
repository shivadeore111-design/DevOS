// ============================================================
// devos/pilots/types.ts — Pilot system type definitions
// ============================================================

export interface PilotManifest {
  id:              string;
  name:            string;
  description:     string;
  version:         string;
  schedule?:       string;
  triggerOnStart?: boolean;
  systemPrompt:    string;
  tools:           string[];
  memoryKey:       string;
  maxIterations:   number;
  outputFormat:    "report" | "json" | "slack" | "file";
  outputPath?:     string;
  enabled:         boolean;
}

export interface PilotRun {
  id:             string;
  pilotId:        string;
  startedAt:      Date;
  completedAt?:   Date;
  status:         "running" | "completed" | "failed";
  output?:        string;
  error?:         string;
  iterationsUsed: number;
}
