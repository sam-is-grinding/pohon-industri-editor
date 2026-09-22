import { useTreeStore } from '../store/useTreeStore'

export function Header() {
  const treeName = useTreeStore((s) => s.treeName)
  const draftVersion = useTreeStore((s) => s.draftVersion)
  const publishStatus = useTreeStore((s) => s.publishStatus)
  const hasUnsavedChanges = useTreeStore((s) => s.hasUnsavedChanges)
  const openNewTreeDialog = useTreeStore((s) => s.openNewTreeDialog)

  return (
    <div className="flex items-center justify-between border-b border-[var(--ink-300)] bg-[var(--ink-950)] px-4 py-2.5 text-[var(--paper)]">
      <div className="flex items-center gap-3">
        <span className="inline-block h-4 w-1.5 bg-[var(--signal-accent)]" />
        <h1 className="font-technical text-[13px] font-semibold tracking-widest">
          POHON INDUSTRI — EDITOR
        </h1>
        <span className="hidden text-[13px] text-[var(--ink-400)] sm:inline">/ {treeName}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="font-technical text-[11.5px] text-[var(--ink-300)]">
          {publishStatus === 'published' ? (
            <>
              Published: <span className="font-semibold text-[var(--paper)]">{draftVersion}</span>
            </>
          ) : (
            <>
              Draft Aktif: <span className="font-semibold text-[var(--paper)]">{draftVersion}</span>{' '}
              (Belum Diterbitkan)
            </>
          )}
          {hasUnsavedChanges && <span className="ml-2 text-[var(--signal-import-gap)]">● unsaved</span>}
        </div>

        <button
          onClick={openNewTreeDialog}
          className="border border-[var(--ink-600)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--paper)] hover:border-[var(--paper)]"
        >
          + Pohon Baru
        </button>
      </div>
    </div>
  )
}
