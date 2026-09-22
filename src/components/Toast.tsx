import { useEffect } from 'react'
import { useTreeStore } from '../store/useTreeStore'

export function Toast() {
  const toast = useTreeStore((s) => s.toast)
  const clearToast = useTreeStore((s) => s.clearToast)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(clearToast, 2600)
    return () => clearTimeout(t)
  }, [toast, clearToast])

  if (!toast) return null

  return (
    <div className="toast-anim fixed bottom-16 left-1/2 z-[60] -translate-x-1/2 border border-[var(--ink-700)] bg-[var(--ink-900)] px-4 py-2 text-[12.5px] text-[var(--paper)] shadow-lg">
      {toast}
    </div>
  )
}
