import type { ValidationIssue } from '../types'
import { useTreeStore } from '../store/useTreeStore'

interface Props {
  issues: ValidationIssue[]
  onClose: () => void
}

export function ValidationPanel({ issues, onClose }: Props) {
  const selectNode = useTreeStore((s) => s.selectNode)
  const openDetail = useTreeStore((s) => s.openDetail)

  const errors = issues.filter((i) => i.level === 'error')
  const warnings = issues.filter((i) => i.level === 'warning')

  return (
    <div className="absolute bottom-full left-3 right-3 mb-1 max-h-72 overflow-y-auto thin-scroll border border-[var(--ink-300)] bg-[var(--paper)] shadow-lg">
      <div className="flex items-center justify-between border-b border-[var(--ink-200)] px-3 py-2">
        <span className="font-technical text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-700)]">
          Validation
        </span>
        <button onClick={onClose} className="text-[14px] leading-none text-[var(--ink-500)] hover:text-[var(--ink-900)]">
          ×
        </button>
      </div>

      {issues.length === 0 && (
        <div className="px-3 py-4 text-[12.5px] text-[var(--ink-400)]">
          Tidak ada masalah. Topologi valid.
        </div>
      )}

      {errors.length > 0 && (
        <div className="px-3 py-2">
          <div className="mb-1 font-technical text-[10px] font-semibold uppercase tracking-wide text-[var(--signal-critical)]">
            Error
          </div>
          {errors.map((e) => (
            <button
              key={e.id}
              onClick={() => {
                const nodeId = e.relatedNodeIds?.[0]
                if (nodeId) {
                  selectNode(nodeId)
                  openDetail(nodeId)
                }
              }}
              className="mb-1.5 block w-full border-l-2 border-[var(--signal-critical)] bg-[var(--ink-50)] px-2.5 py-1.5 text-left"
            >
              <div className="text-[12.5px] font-medium text-[var(--ink-900)]">{e.message}</div>
              {e.detail && <div className="text-[11.5px] text-[var(--ink-500)]">{e.detail}</div>}
            </button>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="px-3 py-2">
          <div className="mb-1 font-technical text-[10px] font-semibold uppercase tracking-wide text-[var(--signal-import-gap)]">
            Warning
          </div>
          {warnings.map((w) => (
            <button
              key={w.id}
              onClick={() => {
                const nodeId = w.relatedNodeIds?.[0]
                if (nodeId) {
                  selectNode(nodeId)
                  openDetail(nodeId)
                }
              }}
              className="mb-1.5 block w-full border-l-2 border-[var(--signal-import-gap)] bg-[var(--ink-50)] px-2.5 py-1.5 text-left"
            >
              <div className="text-[12.5px] font-medium text-[var(--ink-900)]">{w.message}</div>
              {w.detail && <div className="text-[11.5px] text-[var(--ink-500)]">{w.detail}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
