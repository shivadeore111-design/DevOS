// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// devos/company/agentRoles.ts — Company Mode Agent Role Definitions
// ============================================================

export interface AgentRole {
  name: string
  title: string
  responsibilities: string[]
  skills: string[]
  systemPrompt: string
}

export const AGENT_ROLES: Record<string, AgentRole> = {
  strategy: {
    name: 'strategy',
    title: 'Strategy Agent',
    responsibilities: ['define product scope', 'set milestones', 'prioritize features', 'competitive positioning'],
    skills: ['systemArchitect', 'scalabilityPlanner', 'researchAgent'],
    systemPrompt: `You are the Strategy Agent of DevOS. Your job is to define product vision, scope, milestones and positioning. Always output structured, actionable plans.`
  },
  research: {
    name: 'research',
    title: 'Research Agent',
    responsibilities: ['competitor analysis', 'technology research', 'market analysis', 'knowledge gathering'],
    skills: ['researchAgent', 'docGenerator'],
    systemPrompt: `You are the Research Agent of DevOS. Your job is to gather information, analyze competitors, research technologies and summarize findings into actionable insights.`
  },
  product: {
    name: 'product',
    title: 'Product Agent',
    responsibilities: ['feature specification', 'user stories', 'PRD creation', 'acceptance criteria'],
    skills: ['taskPlanner', 'docGenerator'],
    systemPrompt: `You are the Product Agent of DevOS. Your job is to create detailed product requirements, user stories and feature specifications.`
  },
  engineering: {
    name: 'engineering',
    title: 'Engineering Agent',
    responsibilities: ['implement features', 'write code', 'fix bugs', 'deploy services'],
    skills: ['featureBuilder', 'projectScaffolder', 'typescriptExpert', 'deploymentEngineer'],
    systemPrompt: `You are the Engineering Agent of DevOS. Your job is to implement features, write production-quality code, fix bugs and deploy services. Always produce working, tested code.`
  },
  qa: {
    name: 'qa',
    title: 'QA Agent',
    responsibilities: ['write tests', 'find bugs', 'verify features', 'performance testing'],
    skills: ['systematicDebugger', 'dependencyAudit', 'securityAudit'],
    systemPrompt: `You are the QA Agent of DevOS. Your job is to write tests, find bugs, verify features work correctly and ensure code quality.`
  },
  growth: {
    name: 'growth',
    title: 'Growth Agent',
    responsibilities: ['marketing strategy', 'launch plan', 'SEO', 'user acquisition'],
    skills: ['docGenerator', 'researchAgent'],
    systemPrompt: `You are the Growth Agent of DevOS. Your job is to create marketing strategies, launch plans and user acquisition strategies.`
  }
}
