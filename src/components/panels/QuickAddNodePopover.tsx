import { useEffect, useMemo, useRef, useState } from 'react'
import { useTreeStore } from '../../store/useTreeStore'
import { masterCatalog } from '../../data/masterCatalog'
import type { NodeType } from '../../types'
import { NODE_TYPE_LABEL } from '../../types'

const FILTERS: Array<{ id: NodeType | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'raw_material', label: 'Raw Material' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'finished_product', label: 'Finished Product' },
  { id: 'application', label: 'Application' },
]

const POPOVER_WIDTH = 320
const POPOVER_HEIGHT = 420

interface Props {
  /** screen coordinates (viewport px) to float the popup around */
  screenX: number
  screenY: number
  /** canvas/flow coordinates for where the new node should be placed */
  flowPosition: { x: number; y: number }
  /** stage the new node will land in, purely for the header label */
  stageLabel?: string
  stageId: string
  /** if set, a new relationship is proposed from this node to the newly created one */
  connectFromId?: string | null
  onClose: () => void
}

export function QuickAddNodePopover({
  screenX,
  screenY,
  flowPosition,
  stageLabel,
  stageId,
  connectFromId,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const treeNodes = useTreeStore((s) => s.treeNodes)
  const addNodeFromCatalog = useTreeStore((s) => s.addNodeFromCatalog)
  const requestConnection = useTreeStore((s) => s.requestConnection)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<NodeType | 'all'>('all')

  // Once the user drags the header, the popover's position is pinned here (in screen px) and
  // no longer recomputed from screenX/screenY — this holds it wherever it was dropped.
  const [dragPos, setDragPos] = useState<{ left: number; top: number } | null>(null)
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null)

  useEffect(() => {
    // Left click only — a right-click elsewhere (e.g. opening a context menu) shouldn't also
    // dismiss this popover.
    function handleClick(e: MouseEvent) {
      if (e.button !== 0) return
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    // Capture phase: React Flow's own pane pan/zoom handling stops mousedown from bubbling up
    // to the document, so a bubble-phase listener here would never see clicks on the canvas.
    // Listening during capture (before React Flow's handlers run) makes outside-click closing
    // work no matter where on the canvas the click lands.
    document.addEventListener('mousedown', handleClick, true)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick, true)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  const usedIds = useMemo(() => new Set(treeNodes.map((n) => n.masterNodeId)), [treeNodes])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return masterCatalog.filter((n) => {
      const matchesFilter = filter === 'all' || n.nodeType === filter
      const matchesQuery =
        q.length === 0 || n.name.toLowerCase().includes(q) || n.hsCode.toLowerCase().includes(q)
      return matchesFilter && matchesQuery
    })
  }, [query, filter])

  // Center the popup on the cursor, but clamp so it never runs off-screen. On narrow phones the
  // popover can be wider/taller than the screen itself — sizing it down to fit (instead of only
  // clamping its position) is what keeps it centered instead of jammed against one edge with a
  // lopsided gap on the other.
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : POPOVER_WIDTH
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : POPOVER_HEIGHT
  const effectiveWidth = Math.min(POPOVER_WIDTH, viewportWidth - 24)
  const effectiveHeight = Math.min(POPOVER_HEIGHT, viewportHeight - 24)

  const defaultLeft = Math.min(Math.max(screenX - effectiveWidth / 2, 12), viewportWidth - effectiveWidth - 12)
  const defaultTop = Math.min(Math.max(screenY - effectiveHeight / 2, 12), viewportHeight - effectiveHeight - 12)
  const left = dragPos?.left ?? defaultLeft
  const top = dragPos?.top ?? defaultTop

  function onHeaderPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Don't start a drag when the click is on the close button.
    if ((e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragOffsetRef.current = { dx: e.clientX - left, dy: e.clientY - top }
  }

  function onHeaderPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const offset = dragOffsetRef.current
    if (!offset) return
    const maxLeft = Math.max((typeof window !== 'undefined' ? window.innerWidth : effectiveWidth) - effectiveWidth - 8, 8)
    const maxTop = Math.max((typeof window !== 'undefined' ? window.innerHeight : 40) - 40, 8)
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

  function pick(masterNodeId: string) {
    const newId = addNodeFromCatalog(masterNodeId, stageId, flowPosition)
    if (newId && connectFromId && connectFromId !== newId) {
      requestConnection(connectFromId, newId, { x: screenX, y: screenY })
    }
    onClose()
  }

  return (
    <div
      ref={ref}
      style={{ left, top, width: effectiveWidth, maxHeight: effectiveHeight }}
      className="fixed z-50 flex flex-col border border-[var(--ink-300)] bg-[var(--paper)] shadow-xl"
    >
      <div
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
        className="flex cursor-move touch-none items-center justify-between border-b border-[var(--ink-200)] px-3 py-2 select-none"
      >
        <h2 className="font-technical text-[11.5px] font-semibold uppercase tracking-wide text-[var(--ink-900)]">
          {connectFromId ? 'Hubungkan ke Simpul Baru' : 'Tambah Simpul'}
        </h2>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center text-[22px] leading-none text-[var(--ink-500)] hover:text-[var(--ink-900)]"
        >
          ×
        </button>
      </div>

      {stageLabel && (
        <div className="border-b border-[var(--ink-200)] px-3 py-1.5 font-technical text-[10px] text-[var(--ink-500)]">
          Target stage: <span className="font-semibold text-[var(--ink-800)]">{stageLabel}</span>
        </div>
      )}

      <div className="px-3 py-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search simpul... (nama / HS code)"
          className="w-full border border-[var(--ink-300)] bg-[var(--paper)] px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--ink-700)]"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`border px-2 py-1 text-[11px] ${
                filter === f.id
                  ? 'border-[var(--ink-900)] bg-[var(--ink-900)] text-[var(--paper)]'
                  : 'border-[var(--ink-300)] text-[var(--ink-600)] hover:border-[var(--ink-600)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="thin-scroll flex-1 overflow-y-auto px-2 pb-3">
        {results.length === 0 && (
          <div className="px-2 py-6 text-center text-[12.5px] text-[var(--ink-400)]">
            Tidak ada simpul yang cocok.
          </div>
        )}
        {results.map((n) => {
          const inTree = usedIds.has(n.id)
          return (
            <button
              key={n.id}
              disabled={inTree}
              onClick={() => pick(n.id)}
              className={`mb-1 flex w-full items-start gap-2.5 border px-3 py-2 text-left ${
                inTree
                  ? 'cursor-not-allowed border-transparent opacity-40'
                  : 'border-transparent hover:border-[var(--ink-300)] hover:bg-[var(--ink-50)]'
              }`}
            >
              <span className="mt-0.5 text-[13px] text-[var(--ink-400)]">○</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-[var(--ink-900)]">{n.name}</span>
                <span className="block font-technical text-[10.5px] text-[var(--ink-500)]">
                  HS {n.hsCode} · {NODE_TYPE_LABEL[n.nodeType]}
                </span>
              </span>
              {inTree && (
                <span className="mt-0.5 whitespace-nowrap font-technical text-[10px] text-[var(--ink-400)]">
                  Already in tree
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
