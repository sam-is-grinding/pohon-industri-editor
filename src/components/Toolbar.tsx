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
  const removeSelectedEdge = useTreeStore((s) => s.removeSelectedEdge)
  const undo = useTreeStore((s) => s.undo)
  const redo = useTreeStore((s) => s.redo)
  const canUndo = useTreeStore((s) => s.past.length > 0)
  const canRedo = useTreeStore((s) => s.future.length > 0)
  const connectSourceId = useTreeStore((s) => s.connectSourceId)

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--ink-300)] bg-[var(--paper)] px-3 py-2">
      <ToolbarButton onClick={removeSelectedEdge} title="Hapus relasi terpilih">
        Hapus Relasi
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-[var(--ink-200)]" />

      <ToolbarButton onClick={undo} title="Undo">
        <span className={canUndo ? '' : 'opacity-40'}>↶ Undo</span>
      </ToolbarButton>
      <ToolbarButton onClick={redo} title="Redo">
        <span className={canRedo ? '' : 'opacity-40'}>↷ Redo</span>
      </ToolbarButton>

      <div className="ml-auto flex items-center gap-2">
        {mode === 'connect' && (
          <span className="font-technical text-[11px] text-[var(--ink-500)]">
            {connectSourceId ? 'Klik node tujuan…' : 'Klik node sumber…'}
          </span>
        )}
        {mode !== 'connect' && (
          <span className="font-technical text-[11px] text-[var(--ink-500)]">
            Klik kanan + tahan + geser di canvas untuk multi-select · Delete untuk hapus yang dipilih
          </span>
        )}
      </div>
    </div>
  )
}
