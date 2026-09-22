import { useMemo, useState } from 'react'
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

export function NodeCatalogPanel() {
  const isOpen = useTreeStore((s) => s.isCatalogOpen)
  const close = useTreeStore((s) => s.closeCatalog)
  const treeNodes = useTreeStore((s) => s.treeNodes)
  const addNodeFromCatalog = useTreeStore((s) => s.addNodeFromCatalog)
  const activeStage = useTreeStore((s) => s.stages.find((st) => st.id === s.activeStageId))

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<NodeType | 'all'>('all')

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

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={close} />
      <div className="fixed left-0 top-0 z-40 flex h-full w-[340px] flex-col border-r border-[var(--ink-300)] bg-[var(--paper)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--ink-200)] px-4 py-3">
          <h2 className="font-technical text-[12.5px] font-semibold uppercase tracking-wide text-[var(--ink-900)]">
            Tambah Simpul
          </h2>
          <button onClick={close} className="text-[16px] leading-none text-[var(--ink-500)] hover:text-[var(--ink-900)]">
            ×
          </button>
        </div>

        <div className="border-b border-[var(--ink-200)] px-4 py-2.5">
          <div className="font-technical text-[10.5px] text-[var(--ink-500)]">
            Target stage: <span className="font-semibold text-[var(--ink-800)]">{activeStage ? `${activeStage.code} — ${activeStage.name}` : '—'}</span>
          </div>
        </div>

        <div className="px-4 py-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search simpul... (nama / HS code)"
            className="w-full border border-[var(--ink-300)] bg-[var(--paper)] px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--ink-700)]"
          />

          <div className="mt-2.5 flex flex-wrap gap-1.5">
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

        <div className="thin-scroll flex-1 overflow-y-auto px-2 pb-4">
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
                onClick={() => addNodeFromCatalog(n.id)}
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
    </>
  )
}
