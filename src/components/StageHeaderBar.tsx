import { useState } from 'react'
import { useTreeStore } from '../store/useTreeStore'
import { STAGE_COLUMN_WIDTH } from '../utils/layout'

interface Props {
  /** current horizontal scroll/pan offset (in canvas px) and zoom, from React Flow's viewport */
  translateX: number
  zoom: number
}

export function StageHeaderBar({ translateX, zoom }: Props) {
  const stages = useTreeStore((s) => s.stages)
  const activeStageId = useTreeStore((s) => s.activeStageId)
  const setActiveStage = useTreeStore((s) => s.setActiveStage)
  const addStage = useTreeStore((s) => s.addStage)
  const removeStage = useTreeStore((s) => s.removeStage)
  const renameStage = useTreeStore((s) => s.renameStage)
  const reorderStage = useTreeStore((s) => s.reorderStage)

  const sortedStages = [...stages].sort((a, b) => a.order - b.order)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

  return (
    <div className="relative h-[52px] overflow-hidden border-b border-[var(--ink-300)] bg-[var(--ink-50)]">
      {/*
        Only position (translateX) and column width scale with zoom, so the columns stay
        aligned with the canvas grid below. We deliberately do NOT apply a CSS `scale()`
        transform here, since that would scale the text along with it — font size stays fixed.
      */}
      <div className="absolute top-0 flex h-full" style={{ transform: `translateX(${translateX}px)` }}>
        {sortedStages.map((stage, idx) => {
          const isActive = stage.id === activeStageId
          const isEditing = editingId === stage.id
          return (
            <div
              key={stage.id}
              style={{ width: STAGE_COLUMN_WIDTH * zoom }}
              className={`group relative flex h-full flex-none flex-col items-center justify-center overflow-hidden border-r border-dashed border-[var(--ink-300)] px-2 ${
                isActive ? 'bg-[var(--ink-100)]' : ''
              }`}
            >
              <div className="flex max-w-full items-center justify-center gap-1.5">
                <button
                  onClick={() => setActiveStage(stage.id)}
                  className="shrink-0 font-technical text-[13px] font-semibold text-[var(--ink-900)]"
                  title="Jadikan stage aktif untuk 'Tambah Simpul'"
                >
                  {stage.code}
                </button>

                {isEditing ? (
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={() => {
                      renameStage(stage.id, draftName.trim() || stage.name)
                      setEditingId(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        renameStage(stage.id, draftName.trim() || stage.name)
                        setEditingId(null)
                      }
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="w-24 border-b border-[var(--ink-500)] bg-transparent text-center text-[12px] outline-none"
                  />
                ) : (
                  <button
                    onClick={() => {
                      setEditingId(stage.id)
                      setDraftName(stage.name)
                    }}
                    className="max-w-full truncate text-[12px] text-[var(--ink-600)] hover:underline"
                    title="Ubah nama stage"
                  >
                    {stage.name}
                  </button>
                )}
              </div>

              <div className="absolute right-1 top-1 hidden items-center gap-0.5 group-hover:flex">
                <button
                  disabled={idx === 0}
                  onClick={() => reorderStage(stage.id, -1)}
                  className="px-1 text-[11px] text-[var(--ink-500)] hover:text-[var(--ink-900)] disabled:opacity-20"
                  title="Geser kiri"
                >
                  ◀
                </button>
                <button
                  disabled={idx === sortedStages.length - 1}
                  onClick={() => reorderStage(stage.id, 1)}
                  className="px-1 text-[11px] text-[var(--ink-500)] hover:text-[var(--ink-900)] disabled:opacity-20"
                  title="Geser kanan"
                >
                  ▶
                </button>
                <button
                  onClick={() => removeStage(stage.id)}
                  className="px-1 text-[13px] text-[var(--ink-500)] hover:text-[var(--signal-critical)]"
                  title="Hapus stage"
                >
                  ×
                </button>
              </div>
            </div>
          )
        })}

        <div style={{ width: Math.max(140 * zoom, 90) }} className="flex h-full flex-none items-center justify-center px-2">
          <button
            onClick={addStage}
            className="whitespace-nowrap border border-dashed border-[var(--ink-400)] px-2.5 py-1 text-[11px] text-[var(--ink-600)] hover:border-[var(--ink-700)] hover:text-[var(--ink-900)]"
          >
            + Stage
          </button>
        </div>
      </div>
    </div>
  )
}
