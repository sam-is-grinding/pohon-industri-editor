import { useEffect, useRef } from 'react'
import { useTreeStore } from '../../store/useTreeStore'

interface Props {
  edgeId: string
  x: number
  y: number
  onClose: () => void
}

export function EdgeContextMenu({ edgeId, x, y, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const removeEdge = useTreeStore((s) => s.removeEdge)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    // Capture phase: React Flow's own pane pan/zoom handling stops mousedown from bubbling up
    // to the document, so a bubble-phase listener here would never see clicks on the canvas.
    document.addEventListener('mousedown', handleClick, true)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick, true)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{ left: x, top: y }}
      className="fixed z-50 w-48 border border-[var(--ink-300)] bg-[var(--paper)] py-1 shadow-lg"
    >
      <button
        onClick={() => {
          removeEdge(edgeId)
          onClose()
        }}
        className="block w-full px-3 py-1.5 text-left text-[12.5px] text-[var(--signal-critical)] hover:bg-[var(--ink-100)]"
      >
        Hapus
      </button>
    </div>
  )
}
