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
      <div
        className="absolute top-0 flex h-full"
        style={{ transform: `translateX(${translateX}px) scale(${zoom})`, transformOrigin: '0 0' }}
      >
        {sortedStages.map((stage, idx) => {
          const isActive = stage.id === activeStageId
          const isEditing = editingId === stage.id
          return (
            <div
              key={stage.id}
              style={{ width: STAGE_COLUMN_WIDTH }}
              className={`group flex h-full flex-col justify-center border-r border-dashed border-[var(--ink-300)] px-3 ${
                isActive ? 'bg-[var(--ink-100)]' : ''
              }`}
            >
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveStage(stage.id)}
                  className="font-technical text-[13px] font-semibold text-[var(--ink-900)]"
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
                    className="w-full border-b border-[var(--ink-500)] bg-transparent text-[12px] outline-none"
                  />
                ) : (
                  <button
                    onClick={() => {
                      setEditingId(stage.id)
                      setDraftName(stage.name)
                    }}
                    className="truncate text-[12px] text-[var(--ink-600)] hover:underline"
                    title="Ubah nama stage"
                  >
                    {stage.name}
                  </button>
                )}

                <div className="ml-auto hidden items-center gap-0.5 group-hover:flex">
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
            </div>
          )
        })}

        <div style={{ width: 140 }} className="flex h-full items-center px-3">
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
