import { useEffect, useRef, useState } from 'react'
import { useTreeStore } from '../../store/useTreeStore'
import { getMasterNode } from '../../data/masterCatalog'
import type { RelationType } from '../../types'
import { RELATION_LABEL } from '../../types'
import { useDraggablePosition } from '../../utils/useDraggablePosition'

const RELATION_OPTIONS: RelationType[] = ['transformation', 'input', 'output', 'application']

const POPOVER_WIDTH = 380
const POPOVER_HEIGHT = 260

export function CreateRelationshipDialog() {
  const pending = useTreeStore((s) => s.pendingConnection)
  const treeNodes = useTreeStore((s) => s.treeNodes)
  const confirmConnection = useTreeStore((s) => s.confirmConnection)
  const cancelConnection = useTreeStore((s) => s.cancelConnection)
  const [relation, setRelation] = useState<RelationType>('transformation')
  const ref = useRef<HTMLDivElement>(null)

  // Floats right where the connection was made (pending.screenX/Y — see requestConnection),
  // clamped to stay fully on-screen, rather than always centered.
  const defaultLeft = pending
    ? Math.min(Math.max(pending.screenX - POPOVER_WIDTH / 2, 12), window.innerWidth - POPOVER_WIDTH - 12)
    : 0
  const defaultTop = pending
    ? Math.min(Math.max(pending.screenY - POPOVER_HEIGHT / 2, 12), window.innerHeight - POPOVER_HEIGHT - 12)
    : 0

  const resetKey = pending ? `${pending.sourceId}:${pending.targetId}` : null
  const { left, top, onHeaderPointerDown, onHeaderPointerMove, onHeaderPointerUp } = useDraggablePosition(
    defaultLeft,
    defaultTop,
    { width: POPOVER_WIDTH, height: POPOVER_HEIGHT },
    resetKey,
  )

  useEffect(() => {
    if (!pending) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) cancelConnection()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [pending, cancelConnection])

  if (!pending) return null

  const sourceTreeNode = treeNodes.find((n) => n.id === pending.sourceId)
  const targetTreeNode = treeNodes.find((n) => n.id === pending.targetId)
  const sourceMaster = sourceTreeNode ? getMasterNode(sourceTreeNode.masterNodeId) : undefined
  const targetMaster = targetTreeNode ? getMasterNode(targetTreeNode.masterNodeId) : undefined

  return (
    <div
      ref={ref}
      style={{ left, top, width: POPOVER_WIDTH }}
      className="fixed z-50 border border-[var(--ink-400)] bg-[var(--paper)] shadow-xl"
    >
      <div
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
        className="flex cursor-move touch-none items-center justify-between border-b border-[var(--ink-200)] px-4 py-2.5 select-none"
      >
        <h2 className="font-technical text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-900)]">
          Create Relationship
        </h2>
        <button
          onClick={cancelConnection}
          className="text-[15px] leading-none text-[var(--ink-500)] hover:text-[var(--ink-900)]"
        >
          ×
        </button>
      </div>

      <div className="space-y-3 px-4 py-4">
        <div>
          <div className="font-technical text-[10px] uppercase tracking-wide text-[var(--ink-500)]">
            Source
          </div>
          <div className="text-[13px] font-medium text-[var(--ink-900)]">{sourceMaster?.name ?? '—'}</div>
        </div>
        <div>
          <div className="font-technical text-[10px] uppercase tracking-wide text-[var(--ink-500)]">
            Target
          </div>
          <div className="text-[13px] font-medium text-[var(--ink-900)]">{targetMaster?.name ?? '—'}</div>
        </div>
        <div>
          <label className="font-technical text-[10px] uppercase tracking-wide text-[var(--ink-500)]">
            Relation
          </label>
          <select
            value={relation}
            onChange={(e) => setRelation(e.target.value as RelationType)}
            className="mt-1 w-full border border-[var(--ink-300)] bg-[var(--paper)] px-2 py-1.5 text-[13px] text-[var(--ink-900)] outline-none focus:border-[var(--ink-700)]"
          >
            {RELATION_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {RELATION_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-[var(--ink-200)] px-4 py-2.5">
        <button
          onClick={cancelConnection}
          className="px-3 py-1.5 text-[12.5px] text-[var(--ink-600)] hover:text-[var(--ink-900)]"
        >
          Cancel
        </button>
        <button
          onClick={() => confirmConnection(relation)}
          className="bg-[var(--ink-900)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--paper)] hover:bg-[var(--ink-700)]"
        >
          Connect
        </button>
      </div>
    </div>
  )
}
