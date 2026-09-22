import { useEffect, useRef, useState } from 'react'
import { useTreeStore } from '../../store/useTreeStore'
import { getMasterNode } from '../../data/masterCatalog'
import type { RelationType } from '../../types'
import { RELATION_LABEL } from '../../types'

const RELATION_OPTIONS: RelationType[] = ['transformation', 'input', 'output', 'application']

const POPOVER_WIDTH = 320
const POPOVER_HEIGHT_ESTIMATE = 250

export function CreateRelationshipDialog() {
  const pending = useTreeStore((s) => s.pendingConnection)
  const treeNodes = useTreeStore((s) => s.treeNodes)
  const confirmConnection = useTreeStore((s) => s.confirmConnection)
  const cancelConnection = useTreeStore((s) => s.cancelConnection)
  const [relation, setRelation] = useState<RelationType>('transformation')

  const ref = useRef<HTMLDivElement>(null)

  // Same "drag the header, it stays pinned wherever you drop it" behavior as
  // QuickAddNodePopover — once dragged, the popup no longer recomputes its position from the
  // connection point.
  const [dragPos, setDragPos] = useState<{ left: number; top: number } | null>(null)
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null)

  // A fresh pending connection (new source/target pair) resets the relation choice and any
  // previous drag offset, so the popup re-centers on the new connection point.
  useEffect(() => {
    setRelation('transformation')
    setDragPos(null)
  }, [pending?.sourceId, pending?.targetId])

  useEffect(() => {
    if (!pending) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) cancelConnection()
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') cancelConnection()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [pending, cancelConnection])

  if (!pending) return null

  const sourceTreeNode = treeNodes.find((n) => n.id === pending.sourceId)
  const targetTreeNode = treeNodes.find((n) => n.id === pending.targetId)
  const sourceMaster = sourceTreeNode ? getMasterNode(sourceTreeNode.masterNodeId) : undefined
  const targetMaster = targetTreeNode ? getMasterNode(targetTreeNode.masterNodeId) : undefined

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : POPOVER_WIDTH
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : POPOVER_HEIGHT_ESTIMATE
  const screenX = pending.screenX ?? viewportWidth / 2
  const screenY = pending.screenY ?? viewportHeight / 2

  // Center the popup on the connection point, but clamp so it never runs off-screen — same
  // approach as QuickAddNodePopover.
  const defaultLeft = Math.min(
    Math.max(screenX - POPOVER_WIDTH / 2, 12),
    viewportWidth - POPOVER_WIDTH - 12,
  )
  const defaultTop = Math.min(
    Math.max(screenY - POPOVER_HEIGHT_ESTIMATE / 2, 12),
    viewportHeight - POPOVER_HEIGHT_ESTIMATE - 12,
  )
  const left = dragPos?.left ?? defaultLeft
  const top = dragPos?.top ?? defaultTop

  function onHeaderPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragOffsetRef.current = { dx: e.clientX - left, dy: e.clientY - top }
  }

  function onHeaderPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const offset = dragOffsetRef.current
    if (!offset) return
    const maxLeft = Math.max(viewportWidth - POPOVER_WIDTH - 8, 8)
    const maxTop = Math.max(viewportHeight - 40, 8)
    setDragPos({
      left: Math.min(Math.max(e.clientX - offset.dx, 8), maxLeft),
      top: Math.min(Math.max(e.clientY - offset.dy, 8), maxTop),
    })
  }

  function onHeaderPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    dragOffsetRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // pointer capture may already be released — safe to ignore
    }
  }

  return (
    <div
      ref={ref}
      style={{ left, top, width: POPOVER_WIDTH }}
      className="fixed z-50 flex flex-col border border-[var(--ink-400)] bg-[var(--paper)] shadow-xl"
    >
      <div
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
        className="flex cursor-move touch-none items-center justify-between border-b border-[var(--ink-200)] px-3 py-2 select-none"
      >
        <h2 className="font-technical text-[11.5px] font-semibold uppercase tracking-wide text-[var(--ink-900)]">
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
