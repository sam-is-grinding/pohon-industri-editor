import { useEffect, useRef } from 'react'
import { useTreeStore } from '../../store/useTreeStore'

interface Props {
  treeNodeId: string
  x: number
  y: number
  onClose: () => void
}

export function NodeContextMenu({ treeNodeId, x, y, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const openDetail = useTreeStore((s) => s.openDetail)
  const removeTreeNode = useTreeStore((s) => s.removeTreeNode)

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

  const items: Array<{ label: string; action: () => void; danger?: boolean }> = [
    {
      label: 'Lihat Detail',
      action: () => {
        openDetail(treeNodeId, { x, y })
        onClose()
      },
    },
    {
      label: 'Remove from Tree',
      danger: true,
      action: () => {
        removeTreeNode(treeNodeId)
        onClose()
      },
    },
  ]

  return (
    <div
      ref={ref}
      style={{ left: x, top: y }}
      className="fixed z-50 w-48 border border-[var(--ink-300)] bg-[var(--paper)] py-1 shadow-lg"
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={item.action}
          className={`block w-full px-3 py-1.5 text-left text-[12.5px] hover:bg-[var(--ink-100)] ${
            item.danger ? 'text-[var(--signal-critical)]' : 'text-[var(--ink-800)]'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
