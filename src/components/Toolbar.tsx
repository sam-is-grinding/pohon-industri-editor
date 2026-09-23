import { useTreeStore } from '../store/useTreeStore'

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center gap-1.5 border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors ${
        active
          ? 'border-[var(--ink-900)] bg-[var(--ink-900)] text-[var(--paper)]'
          : 'border-[var(--ink-300)] bg-[var(--paper)] text-[var(--ink-700)] hover:border-[var(--ink-600)]'
      }`}
    >
      {children}
    </button>
  )
}

export function Toolbar() {
  const mode = useTreeStore((s) => s.mode)
  const undo = useTreeStore((s) => s.undo)
  const redo = useTreeStore((s) => s.redo)
  const canUndo = useTreeStore((s) => s.past.length > 0)
  const canRedo = useTreeStore((s) => s.future.length > 0)
  const connectSourceId = useTreeStore((s) => s.connectSourceId)
  const multiSelectMode = useTreeStore((s) => s.multiSelectMode)
  const toggleMultiSelectMode = useTreeStore((s) => s.toggleMultiSelectMode)
  const selectedCount = useTreeStore((s) => s.selectedNodeIds.length)
  const removeSelectedNodes = useTreeStore((s) => s.removeSelectedNodes)

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--ink-300)] bg-[var(--paper)] px-3 py-2">
      <ToolbarButton onClick={undo} title="Undo">
        <span className={canUndo ? '' : 'opacity-40'}>↶ Undo</span>
      </ToolbarButton>
      <ToolbarButton onClick={redo} title="Redo">
        <span className={canRedo ? '' : 'opacity-40'}>↷ Redo</span>
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-[var(--ink-200)]" />

      {/* Tap-to-select stand-in for the desktop right-click-drag box select / Shift+click, which
          have no touch equivalent. Desktop already has right-click + hold + drag for this, so
          the button itself is mobile-only. */}
      <div className="sm:hidden">
        <ToolbarButton onClick={toggleMultiSelectMode} active={multiSelectMode} title="Pilih beberapa simpul">
          {multiSelectMode ? `Selesai (${selectedCount})` : '☑ Multi-select'}
        </ToolbarButton>
      </div>

      {multiSelectMode && selectedCount > 0 && (
        <ToolbarButton onClick={removeSelectedNodes} title="Hapus simpul terpilih">
          <span className="text-[var(--signal-critical)]">Hapus Terpilih</span>
        </ToolbarButton>
      )}

      <div className="ml-auto flex items-center gap-2">
        {mode === 'connect' && (
          <span className="font-technical text-[11px] text-[var(--ink-500)]">
            {connectSourceId ? 'Klik node tujuan…' : 'Klik node sumber…'}
          </span>
        )}
        {mode !== 'connect' && multiSelectMode && (
          <span className="font-technical text-[11px] text-[var(--ink-500)]">
            <span className="hidden sm:inline">Klik kanan + tahan + geser, atau </span>
            Ketuk simpul untuk pilih/batal, atau tekan &amp; tahan area kosong lalu geser
          </span>
        )}
        {mode !== 'connect' && !multiSelectMode && (
          <span className="hidden font-technical text-[11px] text-[var(--ink-500)] sm:inline">
            Klik kanan + tahan + geser di canvas, atau tombol Multi-select, untuk pilih beberapa simpul
          </span>
        )}
      </div>
    </div>
  )
}
