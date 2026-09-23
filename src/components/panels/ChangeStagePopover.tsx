import { useEffect, useRef } from 'react'
import { useTreeStore } from '../../store/useTreeStore'

interface Props {
  treeNodeId: string
  x: number
  y: number
  onClose: () => void
}

export function ChangeStagePopover({ treeNodeId, x, y, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const stages = useTreeStore((s) => [...s.stages].sort((a, b) => a.order - b.order))
  const currentStageId = useTreeStore((s) => s.treeNodes.find((n) => n.id === treeNodeId)?.stageId)
  const changeNodeStage = useTreeStore((s) => s.changeNodeStage)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{ left: x, top: y }}
      className="fixed z-50 w-52 border border-[var(--ink-300)] bg-[var(--paper)] py-1 shadow-lg"
    >
      <div className="border-b border-[var(--ink-200)] px-3 py-1.5 font-technical text-[10px] uppercase tracking-wide text-[var(--ink-500)]">
        Pindahkan ke stage
      </div>
      {stages.map((stage) => (
        <button
          key={stage.id}
          onClick={() => {
            changeNodeStage(treeNodeId, stage.id)
            onClose()
          }}
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] hover:bg-[var(--ink-100)] ${
            stage.id === currentStageId ? 'font-semibold text-[var(--ink-900)]' : 'text-[var(--ink-700)]'
          }`}
        >
          <span className="font-technical text-[11px] text-[var(--ink-500)]">{stage.code}</span>
          <span className="truncate">{stage.name}</span>
          {stage.id === currentStageId && <span className="ml-auto text-[10px]">●</span>}
        </button>
      ))}
    </div>
  )
}
