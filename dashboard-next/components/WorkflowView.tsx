'use client'

// dashboard-next/components/WorkflowView.tsx
// Pure SVG + React — no external graph dependencies.
// Subscribes to /api/stream SSE for workflow_event updates,
// fetches initial state from GET /api/workflow on mount.

import { useCallback, useEffect, useRef, useState } from 'react'

// ── Types ──────────────────────────────────────────────────────

interface WFNode {
  id:           string
  agent:        string
  label:        string
  status:       'pending' | 'active' | 'completed' | 'failed'
  startedAt?:   number
  completedAt?: number
  duration?:    number
  cost?:        number
  toolCalls:    number
  currentTool?: string
  tier?:        number
}

interface WFEdge {
  id:       string
  from:     string
  to:       string
  label?:   string
  animated: boolean
}

interface WFState {
  id:            string
  goal:          string
  nodes:         WFNode[]
  edges:         WFEdge[]
  status:        'idle' | 'active' | 'completed' | 'failed'
  totalCost:     number
  totalDuration: number
  startedAt?:    number
}

// ── Constants ─────────────────────────────────────────────────

const NODE_W   = 200
const NODE_H   = 72
const STATUS_COLOR: Record<string, string> = {
  pending:   '#6b7280',
  active:    '#f97316',
  completed: '#22c55e',
  failed:    '#ef4444',
}
const STATUS_BG: Record<string, string> = {
  pending:   'rgba(107,114,128,0.08)',
  active:    'rgba(249,115,22,0.10)',
  completed: 'rgba(34,197,94,0.08)',
  failed:    'rgba(239,68,68,0.08)',
}
const AGENT_EMOJI: Record<string, string> = {
  aiden:      '◈',
  researcher: '⌘',
  engineer:   '⚙',
  analyst:    '◎',
}

// ── Layout ────────────────────────────────────────────────────
// Groups nodes by tier and arranges them in columns.

interface NodePos { x: number; y: number }

function layoutNodes(nodes: WFNode[], svgW: number, svgH: number): Map<string, NodePos> {
  const positions = new Map<string, NodePos>()
  if (nodes.length === 0) return positions

  if (nodes.length === 1) {
    positions.set(nodes[0].id, { x: svgW / 2 - NODE_W / 2, y: svgH / 2 - NODE_H / 2 })
    return positions
  }

  // Group by tier (default tier 0)
  const tierMap = new Map<number, WFNode[]>()
  nodes.forEach(n => {
    const t = n.tier ?? 0
    if (!tierMap.has(t)) tierMap.set(t, [])
    tierMap.get(t)!.push(n)
  })

  const tiers    = Array.from(tierMap.keys()).sort((a, b) => a - b)
  const colCount = tiers.length
  const colStep  = Math.min((svgW - 80) / colCount, 280)
  const startX   = (svgW - colStep * (colCount - 1) - NODE_W) / 2

  tiers.forEach((tier, ci) => {
    const col   = tierMap.get(tier)!
    const rowH  = Math.min((svgH - 80) / col.length, 120)
    const startY = (svgH - rowH * (col.length - 1) - NODE_H) / 2
    col.forEach((n, ri) => {
      positions.set(n.id, {
        x: startX + ci * colStep,
        y: startY + ri * rowH,
      })
    })
  })

  return positions
}

// ── Edge path (quadratic bezier) ──────────────────────────────

function edgePath(
  from: NodePos, to: NodePos,
): string {
  const x1 = from.x + NODE_W
  const y1 = from.y + NODE_H / 2
  const x2 = to.x
  const y2 = to.y + NODE_H / 2
  const cx  = (x1 + x2) / 2
  return `M${x1},${y1} Q${cx},${y1} ${cx},${(y1 + y2) / 2} Q${cx},${y2} ${x2},${y2}`
}

// ── Duration / cost formatters ────────────────────────────────

function fmtMs(ms?: number): string {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function fmtUsd(usd?: number): string {
  if (!usd) return ''
  return `$${usd.toFixed(4)}`
}

// ── WorkflowView component ────────────────────────────────────

export default function WorkflowView() {
  const [wf,       setWF]       = useState<WFState | null>(null)
  const [svgSize,  setSvgSize]  = useState({ w: 800, h: 500 })
  const containerRef            = useRef<HTMLDivElement>(null)
  const esRef                   = useRef<EventSource | null>(null)
  const tickRef                 = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch initial state ─────────────────────────────────────
  useEffect(() => {
    fetch('/api/workflow')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setWF(data) })
      .catch(() => {})
  }, [])

  // ── SSE subscription ────────────────────────────────────────
  useEffect(() => {
    const es = new EventSource('/api/stream')
    esRef.current = es

    es.addEventListener('workflow_event', (e: MessageEvent) => {
      try {
        const ev = JSON.parse(e.data) as Record<string, any>
        setWF(prev => applyEvent(prev, ev))
      } catch {}
    })

    return () => { es.close(); esRef.current = null }
  }, [])

  // ── Tick to recalculate active node durations ────────────────
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setWF(prev => prev ? { ...prev } : null)
    }, 1000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [])

  // ── Resize observer ─────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const e = entries[0]
      if (e) setSvgSize({ w: e.contentRect.width, h: e.contentRect.height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // ── Render ──────────────────────────────────────────────────
  const positions = wf ? layoutNodes(wf.nodes, svgSize.w, svgSize.h) : new Map()

  const statusColor = wf ? (STATUS_COLOR[wf.status] ?? '#6b7280') : '#6b7280'

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute', inset: 0,
        background: 'var(--bg)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 10,
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg1)',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Workflow Orchestration
        </span>
        {wf && (
          <>
            <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {wf.goal}
            </span>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 10,
              color: statusColor,
              padding: '2px 8px',
              borderRadius: 4,
              border: `1px solid ${statusColor}44`,
              background: `${statusColor}11`,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              {wf.status}
            </span>
            {wf.totalCost > 0 && (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
                {fmtUsd(wf.totalCost)}
              </span>
            )}
          </>
        )}
        {!wf && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>
            No active workflow — send a message to start
          </span>
        )}
      </div>

      {/* SVG graph */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <style>{ANIM_CSS}</style>
        <svg
          width={svgSize.w}
          height={svgSize.h}
          viewBox={`0 0 ${svgSize.w} ${svgSize.h}`}
          style={{ display: 'block' }}
        >
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#3f3f3f" />
            </marker>
            <marker id="arrow-active" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#f97316" />
            </marker>
          </defs>

          {/* Edges */}
          {wf?.edges.map(edge => {
            const fromPos = positions.get(edge.from)
            const toPos   = positions.get(edge.to)
            if (!fromPos || !toPos) return null
            const d       = edgePath(fromPos, toPos)
            const active  = edge.animated
            return (
              <g key={edge.id}>
                <path
                  d={d}
                  fill="none"
                  stroke={active ? '#f97316' : '#3f3f3f'}
                  strokeWidth={active ? 1.5 : 1}
                  strokeDasharray={active ? '6 3' : undefined}
                  className={active ? 'edge-animated' : undefined}
                  markerEnd={active ? 'url(#arrow-active)' : 'url(#arrow)'}
                />
                {edge.label && (() => {
                  const mx = (fromPos.x + NODE_W + toPos.x) / 2
                  const my = (fromPos.y + toPos.y + NODE_H) / 2
                  return (
                    <text x={mx} y={my - 4} textAnchor="middle" fontSize={9} fill="#6b7280" fontFamily="var(--mono)">
                      {edge.label}
                    </text>
                  )
                })()}
              </g>
            )
          })}

          {/* Nodes */}
          {wf?.nodes.map(node => {
            const pos = positions.get(node.id)
            if (!pos) return null
            const color   = STATUS_COLOR[node.status] ?? '#6b7280'
            const bgColor = STATUS_BG[node.status]   ?? 'rgba(107,114,128,0.08)'
            const emoji   = AGENT_EMOJI[node.agent]  ?? '◆'
            const isActive = node.status === 'active'
            const elapsed = isActive && node.startedAt ? Date.now() - node.startedAt : (node.duration ?? 0)

            return (
              <g key={node.id} transform={`translate(${pos.x},${pos.y})`}>
                {/* Glow ring for active nodes */}
                {isActive && (
                  <rect
                    x={-2} y={-2}
                    width={NODE_W + 4} height={NODE_H + 4}
                    rx={10} ry={10}
                    fill="none"
                    stroke={color}
                    strokeWidth={1}
                    opacity={0.3}
                    className="node-pulse"
                  />
                )}
                {/* Node body */}
                <rect
                  x={0} y={0}
                  width={NODE_W} height={NODE_H}
                  rx={8} ry={8}
                  fill={bgColor}
                  stroke={color}
                  strokeWidth={isActive ? 1.5 : 1}
                />
                {/* Status bar (left edge) */}
                <rect
                  x={0} y={0}
                  width={3} height={NODE_H}
                  rx={2} ry={2}
                  fill={color}
                />
                {/* Agent emoji + label */}
                <text
                  x={14} y={22}
                  fontSize={11}
                  fill={color}
                  fontFamily="var(--mono)"
                >
                  {emoji} {node.agent}
                </text>
                {/* Task label */}
                <text
                  x={14} y={38}
                  fontSize={10}
                  fill="var(--text)"
                  fontFamily="var(--sans)"
                  clipPath={`url(#clip-${node.id})`}
                >
                  {node.label.length > 26 ? node.label.slice(0, 26) + '…' : node.label}
                </text>
                {/* Current tool */}
                {node.currentTool && (
                  <text
                    x={14} y={52}
                    fontSize={9}
                    fill={color}
                    fontFamily="var(--mono)"
                    opacity={0.8}
                  >
                    ⚡ {node.currentTool}
                  </text>
                )}
                {/* Stats row */}
                <text
                  x={14} y={64}
                  fontSize={9}
                  fill="#6b7280"
                  fontFamily="var(--mono)"
                >
                  {node.toolCalls > 0 ? `${node.toolCalls} calls` : ''}
                  {elapsed > 0 ? `  ${fmtMs(elapsed)}` : ''}
                  {node.cost ? `  ${fmtUsd(node.cost)}` : ''}
                </text>
              </g>
            )
          })}

          {/* Empty state */}
          {(!wf || wf.nodes.length === 0) && (
            <text
              x={svgSize.w / 2} y={svgSize.h / 2}
              textAnchor="middle"
              fontSize={13}
              fill="#3f3f3f"
              fontFamily="var(--mono)"
            >
              Waiting for workflow…
            </text>
          )}
        </svg>
      </div>
    </div>
  )
}

// ── Animation CSS ─────────────────────────────────────────────

const ANIM_CSS = `
  @keyframes dashMove {
    to { stroke-dashoffset: -18; }
  }
  @keyframes nodePulse {
    0%, 100% { opacity: 0.3; }
    50%       { opacity: 0.7; }
  }
  .edge-animated {
    animation: dashMove 0.6s linear infinite;
  }
  .node-pulse {
    animation: nodePulse 1.4s ease-in-out infinite;
  }
`

// ── Event reducer ─────────────────────────────────────────────

function applyEvent(prev: WFState | null, ev: Record<string, any>): WFState | null {
  switch (ev.type) {
    case 'workflow:start': {
      return ev.workflow as WFState
    }
    case 'workflow:node:add': {
      if (!prev) return prev
      const node = ev.node as WFNode
      if (prev.nodes.some(n => n.id === node.id)) return prev
      return { ...prev, nodes: [...prev.nodes, node] }
    }
    case 'workflow:node:update': {
      if (!prev) return prev
      return {
        ...prev,
        nodes: prev.nodes.map(n =>
          n.id === ev.nodeId ? { ...n, ...(ev.update as Partial<WFNode>) } : n
        ),
      }
    }
    case 'workflow:edge': {
      if (!prev) return prev
      const edge = ev.edge as WFEdge
      if (prev.edges.some(e => e.id === edge.id)) return prev
      return { ...prev, edges: [...prev.edges, edge] }
    }
    case 'workflow:complete': {
      return ev.workflow as WFState
    }
    default:
      return prev
  }
}
