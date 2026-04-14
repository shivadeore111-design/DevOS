// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/recipeEngine.ts — YAML workflow definitions with typed
// params, explicit tool chains, conditions, and retry logic.

import fs   from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { executeTool } from './toolRegistry'

// ── Schema ────────────────────────────────────────────────────

export interface RecipeStep {
  id:         string
  tool:       string
  args:       Record<string, any>
  condition?: string
  onFail?:    'skip' | 'retry' | 'abort'
  retries?:   number
  timeout?:   number
}

export interface RecipeParam {
  type:        'string' | 'number' | 'boolean'
  required:    boolean
  default?:    any
  description: string
}

export interface Recipe {
  name:        string
  version:     string
  description: string
  trigger:     string[]
  params:      Record<string, RecipeParam>
  steps:       RecipeStep[]
  output:      string
}

// ── Loader ────────────────────────────────────────────────────

function loadRecipe(filePath: string): Recipe | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const recipe  = yaml.load(content) as Recipe

    if (!recipe.name || !recipe.steps || recipe.steps.length === 0) {
      console.log(`[Recipe] Invalid recipe: ${filePath} — missing name or steps`)
      return null
    }

    return recipe
  } catch {
    console.log(`[Recipe] Failed to parse: ${filePath}`)
    return null
  }
}

export function loadAllRecipes(): Recipe[] {
  const recipeDirs = [
    path.join(process.cwd(), 'workspace', 'recipes'),
    path.join(process.cwd(), 'recipes'),
  ]

  const recipes: Recipe[] = []

  for (const dir of recipeDirs) {
    if (!fs.existsSync(dir)) continue

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    for (const file of files) {
      const recipe = loadRecipe(path.join(dir, file))
      if (recipe) recipes.push(recipe)
    }
  }

  if (recipes.length > 0) {
    console.log(`[Recipe] Loaded ${recipes.length} recipes`)
  }
  return recipes
}

// ── Template resolution ───────────────────────────────────────

function resolveTemplate(
  template:    string,
  params:      Record<string, any>,
  stepResults: Record<string, any>,
): string {
  return template.replace(/\{\{(\w+\.[\w.]+)\}\}/g, (match, dotPath) => {
    const parts = dotPath.split('.')
    if (parts[0] === 'params') {
      return String(params[parts[1]] ?? match)
    }
    if (parts[0] === 'steps') {
      const stepResult = stepResults[parts[1]] as any
      if (stepResult && parts[2]) {
        return String(stepResult[parts[2]] ?? stepResult.output ?? match)
      }
      return String(stepResult?.output ?? match)
    }
    return match
  })
}

function resolveArgs(
  args:        Record<string, any>,
  params:      Record<string, any>,
  stepResults: Record<string, any>,
): Record<string, any> {
  const resolved: Record<string, any> = {}
  for (const [key, value] of Object.entries(args)) {
    resolved[key] = typeof value === 'string'
      ? resolveTemplate(value, params, stepResults)
      : value
  }
  return resolved
}

// ── Condition evaluator ───────────────────────────────────────

function evaluateCondition(condition: string, stepResults: Record<string, any>): boolean {
  try {
    const resolved = condition.replace(/steps\.(\w+)\.(\w+)/g, (_full, stepId, prop) => {
      const result = stepResults[stepId] as any
      if (!result) return 'undefined'
      return JSON.stringify(result[prop] ?? result.output)
    })
    // eslint-disable-next-line no-new-func
    return new Function(`return ${resolved}`)() as boolean
  } catch {
    return true // default to true if condition can't be evaluated
  }
}

// ── Executor ──────────────────────────────────────────────────

export async function executeRecipe(
  recipe: Recipe,
  params: Record<string, any>,
): Promise<{ success: boolean; output: string }> {
  console.log(`[Recipe] Executing: ${recipe.name}`)

  // Apply defaults for missing optional params
  for (const [name, def] of Object.entries(recipe.params || {})) {
    if (!(name in params) && 'default' in def) {
      params[name] = def.default
    }
  }

  const stepResults: Record<string, any> = {}

  for (const step of recipe.steps) {
    // Evaluate condition gate
    if (step.condition) {
      try {
        if (!evaluateCondition(step.condition, stepResults)) {
          console.log(`[Recipe] Skipping ${step.id}: condition not met`)
          stepResults[step.id] = { skipped: true }
          continue
        }
      } catch {}
    }

    const resolvedArgs = resolveArgs(step.args || {}, params, stepResults)
    console.log(`[Recipe] Step ${step.id}: ${step.tool}`)

    const maxAttempts = step.retries ?? 1
    let result: any   = null

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        result = await executeTool(step.tool, resolvedArgs)
        if (result?.success) break
      } catch (err) {
        if (attempt === maxAttempts - 1) {
          if (step.onFail === 'abort') {
            return { success: false, output: `Recipe aborted at step ${step.id}: ${err}` }
          }
          // 'skip' or no onFail — mark skipped and continue
          result = { skipped: true, error: String(err), output: '' }
        }
      }
    }

    stepResults[step.id] = result
  }

  const output = resolveTemplate(recipe.output || '', params, stepResults)
  return { success: true, output }
}

// ── Trigger matcher ───────────────────────────────────────────

export interface RecipeMatch {
  recipe: Recipe
  params: Record<string, any>
}

export function matchRecipe(message: string, recipes: Recipe[]): RecipeMatch | null {
  for (const recipe of recipes) {
    for (const trigger of (recipe.trigger || [])) {
      // Extract param names from {{param}} placeholders
      const paramNames = (trigger.match(/\{\{(\w+)\}\}/g) || [])
        .map(p => p.replace(/[{}]/g, ''))

      // Build a regex by replacing {{param}} with capture groups
      const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const pattern = escaped.replace(/\\\{\\\{(\w+)\\\}\\\}/g, '(.+)')

      const match = message.match(new RegExp(`^${pattern}$`, 'i'))
      if (match) {
        console.log(`[Recipe] Matched: ${recipe.name} via trigger: "${trigger}"`)
        const params: Record<string, any> = {}
        paramNames.forEach((name, i) => {
          params[name] = match[i + 1]?.trim()
        })
        return { recipe, params }
      }
    }
  }
  return null
}
