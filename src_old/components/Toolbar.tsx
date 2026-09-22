import { useReactFlow } from '@xyflow/react'
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
  const setMode = useTreeStore((s) => s.setMode)
  const removeSelectedEdge = useTreeStore((s) => s.removeSelectedEdge)
  const openCatalog = useTreeStore((s) => s.openCatalog)
  const undo = useTreeStore((s) => s.undo)
  const redo = useTreeStore((s) => s.redo)
  const canUndo = useTreeStore((s) => s.past.length > 0)
  const canRedo = useTreeStore((s) => s.future.length > 0)
  const connectSourceId = useTreeStore((s) => s.connectSourceId)

  const { zoomIn, zoomOut, fitView } = useReactFlow()

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--ink-300)] bg-[var(--paper)] px-3 py-2">
      <ToolbarButton onClick={openCatalog} title="Tambah simpul dari katalog">
        + Tambah Simpul
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-[var(--ink-200)]" />

      <ToolbarButton
        active={mode === 'connect'}
        onClick={() => setMode(mode === 'connect' ? 'pan' : 'connect')}
        title="Hubungkan dua simpul"
      >
        Connect
      </ToolbarButton>
      <ToolbarButton active={mode === 'pan'} onClick={() => setMode('pan')} title="Mode navigasi standar">
        Pan
      </ToolbarButton>
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
        <span className="font-technical text-[11px] text-[var(--ink-500)]">Zoom</span>
        <ToolbarButton onClick={() => zoomOut()} title="Zoom out">
          −
        </ToolbarButton>
        <ToolbarButton onClick={() => zoomIn()} title="Zoom in">
          +
        </ToolbarButton>
        <ToolbarButton onClick={() => fitView({ padding: 0.2, duration: 250 })} title="Fit ke layar">
          Zoom Fit
        </ToolbarButton>
      </div>
    </div>
  )
}
