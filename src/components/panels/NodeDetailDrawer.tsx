import { useEffect, useRef } from 'react'
import { useTreeStore } from '../../store/useTreeStore'
import { getMasterNode } from '../../data/masterCatalog'
import { NODE_TYPE_LABEL, type NodeStatus, type Priority } from '../../types'
import { statusColor } from '../../utils/statusStyle'
import { useDraggablePosition } from '../../utils/useDraggablePosition'

const PRIORITIES: Priority[] = ['P1', 'P2', 'P3', 'P4']
const STATUSES: NodeStatus[] = ['produced', 'emerging', 'critical', 'import_gap']

const PANEL_WIDTH = 360
const PANEL_HEIGHT = 560

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-technical text-[10px] uppercase tracking-wide text-[var(--ink-500)]">{label}</div>
      <div className="mt-0.5 text-[13px] text-[var(--ink-900)]">{children}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 mt-5 border-b border-[var(--ink-200)] pb-1.5 font-technical text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-600)] first:mt-0">
      {children}
    </div>
  )
}

export function NodeDetailDrawer() {
  const isOpen = useTreeStore((s) => s.isDetailOpen)
  const close = useTreeStore((s) => s.closeDetail)
  const selectedNodeId = useTreeStore((s) => s.selectedNodeId)
  const detailPosition = useTreeStore((s) => s.detailPosition)
  const treeNode = useTreeStore((s) => s.treeNodes.find((n) => n.id === s.selectedNodeId))
  // const stages = useTreeStore((s) => [...s.stages].sort((a, b) => a.order - b.order))
  const stages = useTreeStore((s) => s.stages)
  const changeNodePriority = useTreeStore((s) => s.changeNodePriority)
  const changeNodeStatus = useTreeStore((s) => s.changeNodeStatus)
  const changeNodeStage = useTreeStore((s) => s.changeNodeStage)
  const removeTreeNode = useTreeStore((s) => s.removeTreeNode)
  const edges = useTreeStore((s) => s.edges)
  const treeNodes = useTreeStore((s) => s.treeNodes)

  const sortedStages = [...stages].sort((a, b) => a.order - b.order)

  const ref = useRef<HTMLDivElement>(null)

  // Centers on wherever the node was opened from (double-click, context menu, validation list —
  // see openDetail callers), clamped to stay fully on-screen, mirroring the Quick Add popover.
  // Falls back to a near-top-right default when no position was given.
  const defaultLeft = detailPosition
    ? Math.min(Math.max(detailPosition.screenX - PANEL_WIDTH / 2, 12), window.innerWidth - PANEL_WIDTH - 12)
    : Math.max(window.innerWidth - PANEL_WIDTH - 24, 12)
  const defaultTop = detailPosition
    ? Math.min(Math.max(detailPosition.screenY - PANEL_HEIGHT / 2, 12), window.innerHeight - PANEL_HEIGHT - 12)
    : 84
  const { left, top, onHeaderPointerDown, onHeaderPointerMove, onHeaderPointerUp } = useDraggablePosition(
    defaultLeft,
    defaultTop,
    { width: PANEL_WIDTH, height: PANEL_HEIGHT },
    selectedNodeId,
  )

  useEffect(() => {
    if (!isOpen) return
    // Left click only — a right-click elsewhere (e.g. opening a context menu) shouldn't also
    // dismiss this panel.
    function handleClick(e: MouseEvent) {
      if (e.button !== 0) return
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen, close])

  if (!isOpen || !selectedNodeId || !treeNode) return null

  const master = getMasterNode(treeNode.masterNodeId)
  if (!master) return null

  const stage = stages.find((s) => s.id === treeNode.stageId)

  const incoming = edges
    .filter((e) => e.target === treeNode.id)
    .map((e) => treeNodes.find((n) => n.id === e.source))
    .filter(Boolean)
  const outgoing = edges
    .filter((e) => e.source === treeNode.id)
    .map((e) => treeNodes.find((n) => n.id === e.target))
    .filter(Boolean)

  return (
    <div
      ref={ref}
      style={{ left, top, width: PANEL_WIDTH, maxHeight: PANEL_HEIGHT }}
      className="fixed z-40 flex flex-col border border-[var(--ink-300)] bg-[var(--paper)] shadow-xl"
    >
      <div
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
        className="flex cursor-move touch-none items-center justify-between border-b border-[var(--ink-200)] px-4 py-3 select-none"
      >
        <h2 className="font-technical text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-900)]">
          Node Detail
        </h2>
        <button
          onClick={close}
          className="flex h-7 w-7 items-center justify-center text-[22px] leading-none text-[var(--ink-500)] hover:text-[var(--ink-900)]"
        >
          ×
        </button>
      </div>

      <div className="thin-scroll flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: statusColor(treeNode.editorState.status) }}
            />
            <h3 className="text-[16px] font-semibold text-[var(--ink-900)]">{master.name}</h3>
          </div>
          <div className="font-technical text-[11px] text-[var(--ink-500)]">Read-only master data below</div>

          <SectionTitle>Basic Information</SectionTitle>
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            <Field label="Name">{master.name}</Field>
            <Field label="HS Code">
              <span className="font-technical">{master.hsCode}</span>
            </Field>
            <Field label="Node Type">{NODE_TYPE_LABEL[master.nodeType]}</Field>
            <Field label="Score">
              <span className="font-technical">{master.score.toFixed(1)}</span>
            </Field>
          </div>

          <div className="mt-3 border border-[var(--ink-200)] bg-[var(--ink-50)] p-3">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="font-technical text-[10px] uppercase tracking-wide text-[var(--ink-500)]">
                  Stage (editor state)
                </label>
                <select
                  value={treeNode.stageId}
                  onChange={(e) => changeNodeStage(treeNode.id, e.target.value)}
                  className="mt-1 w-full border border-[var(--ink-300)] bg-[var(--paper)] px-2 py-1.5 text-[13px] outline-none focus:border-[var(--ink-700)]"
                >
                  {sortedStages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-technical text-[10px] uppercase tracking-wide text-[var(--ink-500)]">
                  Priority (editor state)
                </label>
                <select
                  value={treeNode.editorState.priority}
                  onChange={(e) => changeNodePriority(treeNode.id, e.target.value as Priority)}
                  className="mt-1 w-full border border-[var(--ink-300)] bg-[var(--paper)] px-2 py-1.5 text-[13px] outline-none focus:border-[var(--ink-700)]"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-technical text-[10px] uppercase tracking-wide text-[var(--ink-500)]">
                  Status (editor state)
                </label>
                <select
                  value={treeNode.editorState.status}
                  onChange={(e) => changeNodeStatus(treeNode.id, e.target.value as NodeStatus)}
                  className="mt-1 w-full border border-[var(--ink-300)] bg-[var(--paper)] px-2 py-1.5 text-[13px] outline-none focus:border-[var(--ink-700)]"
                >
                  {STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-2 font-technical text-[10px] text-[var(--ink-500)]">
              Mengubah nilai di atas tidak mengubah master catalog — hanya state pohon ini.
            </div>
          </div>

          <SectionTitle>Trade</SectionTitle>
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            <Field label="Export">${master.exportValue.toLocaleString('id-ID')}k</Field>
            <Field label="Import">${master.importValue.toLocaleString('id-ID')}k</Field>
            <Field label="Value Added">{master.valueAdded ? 'Yes' : 'No'}</Field>
            <Field label="Current stage">{stage ? `${stage.code} — ${stage.name}` : '—'}</Field>
          </div>

          <SectionTitle>Intellectual Property</SectionTitle>
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            <Field label="PT Dalam Negeri">{master.patents.universityDomestic}</Field>
            <Field label="BRIN">{master.patents.brin}</Field>
            <Field label="Industri Dalam Negeri">{master.patents.domesticIndustry}</Field>
            <Field label="Luar Negeri">{master.patents.foreign}</Field>
            <Field label="Lainnya">{master.patents.other}</Field>
          </div>

          <SectionTitle>Application</SectionTitle>
          {master.applications.length === 0 ? (
            <div className="text-[12.5px] text-[var(--ink-400)]">—</div>
          ) : (
            <ul className="list-disc space-y-1 pl-4 text-[13px] text-[var(--ink-800)]">
              {master.applications.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}

          <SectionTitle>Relationships</SectionTitle>
          <div className="space-y-1 text-[13px]">
            {incoming.length === 0 && outgoing.length === 0 && (
              <div className="text-[12.5px] text-[var(--ink-400)]">Belum ada relasi.</div>
            )}
            {incoming.map((n) => {
              const m = n ? getMasterNode(n.masterNodeId) : undefined
              return (
                <div key={`in-${n?.id}`} className="text-[var(--ink-800)]">
                  ← {m?.name ?? '—'}
                </div>
              )
            })}
            {outgoing.map((n) => {
              const m = n ? getMasterNode(n.masterNodeId) : undefined
              return (
                <div key={`out-${n?.id}`} className="text-[var(--ink-800)]">
                  → {m?.name ?? '—'}
                </div>
              )
            })}
          </div>
        </div>

        <div className="border-t border-[var(--ink-200)] px-4 py-3">
          <button
            onClick={() => removeTreeNode(treeNode.id)}
            className="w-full border border-[var(--signal-critical)] py-1.5 text-[12.5px] font-medium text-[var(--signal-critical)] hover:bg-[var(--signal-critical)] hover:text-[var(--paper)]"
          >
            Remove from Tree
          </button>
        </div>
      </div>
  )
}
