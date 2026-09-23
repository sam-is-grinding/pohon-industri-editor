import type { IndustrialEdge, TreeNode } from '../types'

/**
 * Determines which tree nodes should be hidden because of collapsed ancestors.
 *
 * Rule: a node is hidden only if it has at least one parent AND every one of its parents is
 * either explicitly collapsed or itself hidden. This means a node with multiple parents stays
 * visible as long as at least one parent branch is still expanded/visible — two branches that
 * later re-converge on a shared descendant won't hide that descendant just because one of the
 * branches happens to be collapsed.
 *
 * Implemented as a fixed-point iteration (rather than a single top-down pass) so it stays
 * correct even if the underlying relation graph isn't a strict tree (shared parents, or — in
 * malformed data — cycles): each pass recomputes hidden-ness purely from the previous pass's
 * result, and we stop as soon as a pass produces no change (bounded by node count so it always
 * terminates).
 */
export function computeHiddenNodeIds(
  treeNodes: TreeNode[],
  edges: IndustrialEdge[],
  collapsedIds: Set<string>,
): Set<string> {
  if (collapsedIds.size === 0) return new Set()

  const parentsOf = new Map<string, string[]>()
  for (const n of treeNodes) parentsOf.set(n.id, [])
  for (const e of edges) {
    if (e.source === e.target) continue
    if (!parentsOf.has(e.target)) continue
    parentsOf.get(e.target)!.push(e.source)
  }

  let hidden = new Set<string>()
  const maxPasses = treeNodes.length + 1

  for (let pass = 0; pass < maxPasses; pass++) {
    const next = new Set<string>()
    for (const n of treeNodes) {
      const parents = parentsOf.get(n.id) ?? []
      const shouldHide =
        parents.length > 0 && parents.every((p) => collapsedIds.has(p) || hidden.has(p))
      if (shouldHide) next.add(n.id)
    }
    const changed = next.size !== hidden.size || [...next].some((id) => !hidden.has(id))
    hidden = next
    if (!changed) break
  }

  return hidden
}

/** Direct-child count per node id, used to decide whether a node shows a collapse badge. */
export function computeChildCounts(edges: IndustrialEdge[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const e of edges) {
    if (e.source === e.target) continue
    counts.set(e.source, (counts.get(e.source) ?? 0) + 1)
  }
  return counts
}
