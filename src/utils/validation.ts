import type { IndustrialEdge, TreeNode, ValidationIssue } from '../types'
import { getMasterNode } from '../data/masterCatalog'
import { makeId } from './id'

export function validateTopology(
  treeNodes: TreeNode[],
  edges: IndustrialEdge[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const nodeIds = new Set(treeNodes.map((n) => n.id))

  // 1. Self-loops
  for (const e of edges) {
    if (e.source === e.target) {
      issues.push({
        id: makeId('issue'),
        level: 'error',
        message: 'Self-loop terdeteksi',
        detail: `${nodeLabel(e.source, treeNodes)} terhubung ke dirinya sendiri`,
        relatedEdgeIds: [e.id],
        relatedNodeIds: [e.source],
      })
    }
  }

  // 2. Dangling edges (source/target missing from tree)
  for (const e of edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) {
      issues.push({
        id: makeId('issue'),
        level: 'error',
        message: 'Relasi mengarah ke node yang tidak ada',
        detail: `Edge ${e.id}`,
        relatedEdgeIds: [e.id],
      })
    }
  }

  // 3. Circular dependency detection (DFS with path tracking)
  const adjacency = new Map<string, string[]>()
  for (const e of edges) {
    if (e.source === e.target) continue
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue
    if (!adjacency.has(e.source)) adjacency.set(e.source, [])
    adjacency.get(e.source)!.push(e.target)
  }

  const visited = new Set<string>()
  const stack = new Set<string>()
  const path: string[] = []
  const reportedCycles = new Set<string>()

  function dfs(nodeId: string) {
    visited.add(nodeId)
    stack.add(nodeId)
    path.push(nodeId)

    for (const next of adjacency.get(nodeId) ?? []) {
      if (stack.has(next)) {
        const cycleStart = path.indexOf(next)
        const cyclePath = path.slice(cycleStart).concat(next)
        const key = [...new Set(cyclePath)].sort().join('|')
        if (!reportedCycles.has(key)) {
          reportedCycles.add(key)
          issues.push({
            id: makeId('issue'),
            level: 'error',
            message: 'Circular relation terdeteksi',
            detail: cyclePath.map((id) => nodeLabel(id, treeNodes)).join(' → '),
            relatedNodeIds: cyclePath,
          })
        }
      } else if (!visited.has(next)) {
        dfs(next)
      }
    }

    stack.delete(nodeId)
    path.pop()
  }

  for (const n of treeNodes) {
    if (!visited.has(n.id)) dfs(n.id)
  }

  // 4. Every node must have a stage (guaranteed by type, but re-check defensively)
  for (const n of treeNodes) {
    if (!n.stageId) {
      issues.push({
        id: makeId('issue'),
        level: 'error',
        message: 'Node tanpa stage',
        detail: nodeLabel(n.id, treeNodes),
        relatedNodeIds: [n.id],
      })
    }
  }

  // 5. Warnings: isolated nodes / nodes without outgoing relation
  const hasOutgoing = new Set(edges.filter((e) => e.source !== e.target).map((e) => e.source))
  const hasIncoming = new Set(edges.filter((e) => e.source !== e.target).map((e) => e.target))

  for (const n of treeNodes) {
    const outgoing = hasOutgoing.has(n.id)
    const incoming = hasIncoming.has(n.id)
    if (!outgoing && !incoming) {
      issues.push({
        id: makeId('issue'),
        level: 'warning',
        message: `Node ${nodeLabel(n.id, treeNodes)} belum terhubung ke node manapun`,
        relatedNodeIds: [n.id],
      })
    } else if (!outgoing) {
      issues.push({
        id: makeId('issue'),
        level: 'warning',
        message: `Node ${nodeLabel(n.id, treeNodes)} belum memiliki outgoing relation`,
        relatedNodeIds: [n.id],
      })
    }
  }

  return issues
}

function nodeLabel(treeNodeId: string, treeNodes: TreeNode[]): string {
  const tn = treeNodes.find((n) => n.id === treeNodeId)
  if (!tn) return treeNodeId
  const master = getMasterNode(tn.masterNodeId)
  return master?.name ?? tn.masterNodeId
}
