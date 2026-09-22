import type { IndustrialEdge, TreeNode } from '../types'

/**
 * Fixed-point reachability check: a node is hidden only once EVERY edge feeding into it comes
 * from a source that is itself collapsed or already hidden. Collapsing a node therefore hides
 * its whole downstream subtree (cascading through several stages), but a node that still has
 * another, non-collapsed parent stays visible — so two branches merging back together (one
 * collapsed, one not) don't lose a node the visible branch still needs.
 *
 * Cost is O(nodes * edges) worst case, which is fine at the scale this editor works at (tens to
 * low hundreds of nodes) — re-run only when treeNodes/edges/collapsedNodeIds actually change.
 */
export function computeHiddenNodeIds(
  treeNodes: TreeNode[],
  edges: IndustrialEdge[],
  collapsedNodeIds: string[],
): Set<string> {
  if (collapsedNodeIds.length === 0) return new Set()

  const collapsed = new Set(collapsedNodeIds)
  const incomingByTarget = new Map<string, string[]>()
  for (const e of edges) {
    if (e.source === e.target) continue
    if (!incomingByTarget.has(e.target)) incomingByTarget.set(e.target, [])
    incomingByTarget.get(e.target)!.push(e.source)
  }

  const hidden = new Set<string>()
  let changed = true
  while (changed) {
    changed = false
    for (const n of treeNodes) {
      if (hidden.has(n.id)) continue
      const sources = incomingByTarget.get(n.id)
      if (!sources || sources.length === 0) continue
      const allSourcesGoneAway = sources.every((s) => collapsed.has(s) || hidden.has(s))
      if (allSourcesGoneAway) {
        hidden.add(n.id)
        changed = true
      }
    }
  }
  return hidden
}

/** Whether a node has at least one outgoing relation (i.e. anything to collapse). */
export function hasOutgoingRelations(treeNodeId: string, edges: IndustrialEdge[]): boolean {
  return edges.some((e) => e.source === treeNodeId && e.target !== treeNodeId)
}

/** Direct children count — used for the collapse toggle's badge ("N tersembunyi"). */
export function countDirectChildren(treeNodeId: string, edges: IndustrialEdge[]): number {
  return edges.filter((e) => e.source === treeNodeId && e.target !== treeNodeId).length
}
