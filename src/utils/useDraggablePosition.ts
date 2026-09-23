import { useEffect, useRef, useState } from 'react'

interface Size {
  width: number
  height: number
}

/**
 * Positions a floating panel around (defaultLeft, defaultTop), clamped to the viewport, and lets
 * the panel be repositioned by dragging its header. Once dragged, the explicit position "sticks"
 * for as long as the panel stays open. Pass a `resetKey` that changes whenever the panel's
 * subject changes (a different node/connection) — the position snaps back to the default the
 * next time the key changes.
 */
export function useDraggablePosition(defaultLeft: number, defaultTop: number, size: Size, resetKey?: unknown) {
  const [dragPos, setDragPos] = useState<{ left: number; top: number } | null>(null)
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setDragPos(null)
  }, [resetKey])

  const left = dragPos?.left ?? defaultLeft
  const top = dragPos?.top ?? defaultTop

  function onHeaderPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Don't start a drag when the click is on a header button (e.g. the close "×").
    if ((e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragOffsetRef.current = { dx: e.clientX - left, dy: e.clientY - top }
  }

  function onHeaderPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const offset = dragOffsetRef.current
    if (!offset) return
    const maxLeft = Math.max((typeof window !== 'undefined' ? window.innerWidth : size.width) - size.width - 8, 8)
    const maxTop = Math.max((typeof window !== 'undefined' ? window.innerHeight : size.height) - 40, 8)
    setDragPos({
      left: Math.min(Math.max(e.clientX - offset.dx, 8), maxLeft),
      top: Math.min(Math.max(e.clientY - offset.dy, 8), maxTop),
    })
  }

  function onHeaderPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    dragOffsetRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // pointer capture may already be released — safe to ignore
    }
  }

  return { left, top, onHeaderPointerDown, onHeaderPointerMove, onHeaderPointerUp }
}
