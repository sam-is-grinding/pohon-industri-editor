import { useMemo } from 'react'
import { useTreeStore } from '../store/useTreeStore'
import { validateTopology } from '../utils/validation'
import { ValidationPanel } from './ValidationPanel'

export function ValidationBar() {
  const treeNodes = useTreeStore((s) => s.treeNodes)
  const edges = useTreeStore((s) => s.edges)
  const isPanelOpen = useTreeStore((s) => s.isValidationPanelOpen)
  const togglePanel = useTreeStore((s) => s.toggleValidationPanel)
  const discardChanges = useTreeStore((s) => s.discardChanges)
  const saveDraft = useTreeStore((s) => s.saveDraft)
  const publish = useTreeStore((s) => s.publish)

  const issues = useMemo(() => validateTopology(treeNodes, edges), [treeNodes, edges])
  const errorCount = issues.filter((i) => i.level === 'error').length
  const warningCount = issues.filter((i) => i.level === 'warning').length
  const isValid = errorCount === 0

  return (
    <div className="relative border-t border-[var(--ink-300)] bg-[var(--paper)] px-3 py-2">
      <div className="flex items-center justify-between">
        <button
          onClick={togglePanel}
          className="flex items-center gap-2 text-[12.5px]"
          title="Lihat detail validasi"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isValid ? 'bg-[var(--signal-produced)]' : 'bg-[var(--signal-critical)]'
            }`}
          />
          <span className="font-medium text-[var(--ink-900)]">
            Status Topologi: {isValid ? 'Valid' : 'Invalid'}
          </span>
          {!isValid && (
            <span className="font-technical text-[11px] text-[var(--signal-critical)]">
              {errorCount} masalah ditemukan
            </span>
          )}
          {isValid && warningCount > 0 && (
            <span className="font-technical text-[11px] text-[var(--signal-import-gap)]">
              {warningCount} peringatan
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={discardChanges}
            className="border border-[var(--ink-300)] px-3 py-1.5 text-[12.5px] text-[var(--ink-700)] hover:border-[var(--ink-600)]"
          >
            BATALKAN PERUBAHAN
          </button>
          <button
            onClick={saveDraft}
            className="border border-[var(--ink-300)] px-3 py-1.5 text-[12.5px] text-[var(--ink-700)] hover:border-[var(--ink-600)]"
          >
            SIMPAN DRAFT
          </button>
          <button
            onClick={publish}
            className="bg-[var(--ink-900)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--paper)] hover:bg-[var(--ink-700)]"
          >
            PUBLISH
          </button>
        </div>
      </div>

      {isPanelOpen && <ValidationPanel issues={issues} onClose={togglePanel} />}
    </div>
  )
}
