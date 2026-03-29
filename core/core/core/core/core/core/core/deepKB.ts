import fs from 'fs'
import path from 'path'

type GraphNode = { id: string; name: string; type: string }
type GraphEdge = { fromId: string; toId: string; relation: string; weight: number }
type Graph = Map<string, GraphEdge[]>

export class DeepKB {
  private graph: Graph = new Map()
  private nodes: Map<string, GraphNode> = new Map()
  private graphPath = path.join(process.cwd(), 'workspace', 'knowledge', 'deep-graph.json')

  constructor() {
    this.load()
  }

  addEntity(id: string, name: string, type: string): void {
    this.nodes.set(id, { id, name, type })
    this.save()
  }

  addRelation(fromId: string, toId: string, relation: string, weight = 1.0): void {
    if (!this.graph.has(fromId)) this.graph.set(fromId, [])
    this.graph.get(fromId)!.push({ fromId, toId, relation, weight })
    this.save()
  }

  // Expand context around a query result — 2 hops max
  expand(startId: string, depth = 2): Array<GraphNode & { relation: string; distance: number }> {
    const visited = new Set<string>()
    const results: Array<GraphNode & { relation: string; distance: number }> = []

    const dfs = (nodeId: string, d: number, rel: string) => {
      if (d === 0 || visited.has(nodeId)) return
      visited.add(nodeId)
      const node = this.nodes.get(nodeId)
      if (node && nodeId !== startId) {
        results.push({ ...node, relation: rel, distance: depth - d + 1 })
      }
      for (const edge of this.graph.get(nodeId) || []) {
        dfs(edge.toId, d - 1, edge.relation)
      }
    }

    dfs(startId, depth, '')
    return results.sort((a, b) => a.distance - b.distance)
  }

  // Auto-extract entities from KB search results and build graph
  ingestFromKBResult(text: string, sourceId: string): void {
    // Extract capitalized multi-word entities (companies, people, places)
    const entities = text.match(/[A-Z][a-z]+ (?:[A-Z][a-z]+ )*[A-Z][a-z]+|[A-Z]{2,}/g) || []
    for (const entity of [...new Set(entities)].slice(0, 10)) {
      const entityId = entity.toLowerCase().replace(/\s+/g, '_')
      this.addEntity(entityId, entity, 'extracted')
      this.addRelation(sourceId, entityId, 'mentions', 0.5)
    }
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(this.graphPath), { recursive: true })
      fs.writeFileSync(this.graphPath, JSON.stringify({
        nodes: Object.fromEntries(this.nodes),
        edges: Object.fromEntries(this.graph),
      }, null, 2))
    } catch {}
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.graphPath)) return
      const data = JSON.parse(fs.readFileSync(this.graphPath, 'utf-8'))
      this.nodes = new Map(Object.entries(data.nodes || {}))
      this.graph = new Map(Object.entries(data.edges || {}))
    } catch {}
  }
}

export const deepKB = new DeepKB()
