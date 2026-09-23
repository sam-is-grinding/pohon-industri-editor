import { useEffect } from 'react'
import { useTreeStore } from '../../store/useTreeStore'
import { getMasterNode } from '../../data/masterCatalog'
import { RELATION_LABEL } from '../../types'

interface Props {
  edgeId: string
  onClose: () => void
}

export function EdgeDetailDialog({ edgeId, onClose }: Props) {
  const edge = useTreeStore((s) => s.edges.find((e) => e.id === edgeId))
  const treeNodes = useTreeStore((s) => s.treeNodes)
  const removeEdge = useTreeStore((s) => s.removeEdge)

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  if (!edge) return null

  const source = treeNodes.find((n) => n.id === edge.source)
  const target = treeNodes.find((n) => n.id === edge.target)
  const sourceMaster = source ? getMasterNode(source.masterNodeId) : undefined
  const targetMaster = target ? getMasterNode(target.masterNodeId) : undefined

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-3" onClick={onClose}>
      <div
        className="w-[380px] max-w-full border border-[var(--ink-400)] bg-[var(--paper)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--ink-200)] px-4 py-2.5">
          <h2 className="font-technical text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-900)]">
            Relationship Detail
          </h2>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div>
            <div className="font-technical text-[10px] uppercase tracking-wide text-[var(--ink-500)]">Source</div>
            <div className="text-[13px] font-medium text-[var(--ink-900)]">{sourceMaster?.name ?? '—'}</div>
          </div>
          <div>
            <div className="font-technical text-[10px] uppercase tracking-wide text-[var(--ink-500)]">Target</div>
            <div className="text-[13px] font-medium text-[var(--ink-900)]">{targetMaster?.name ?? '—'}</div>
          </div>
          <div>
            <div className="font-technical text-[10px] uppercase tracking-wide text-[var(--ink-500)]">
              Relation Type
            </div>
            <div className="text-[13px] font-medium text-[var(--ink-900)]">
              {RELATION_LABEL[edge.relationType]}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--ink-200)] px-4 py-2.5">
          <button
            onClick={() => {
              removeEdge(edge.id)
              onClose()
            }}
            className="px-3 py-1.5 text-[12.5px] text-[var(--signal-critical)] hover:underline"
          >
            Hapus Relasi
          </button>
          <button
            onClick={onClose}
            className="bg-[var(--ink-900)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--paper)] hover:bg-[var(--ink-700)]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
