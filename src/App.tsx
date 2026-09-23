import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useTreeStore } from './store/useTreeStore'
import { Header } from './components/Header'
import { Toolbar } from './components/Toolbar'
import { CanvasEditor } from './components/CanvasEditor'
import { ValidationBar } from './components/ValidationBar'
import { NodeDetailDrawer } from './components/panels/NodeDetailDrawer'
import { NewTreeDialog } from './components/panels/NewTreeDialog'
import { Toast } from './components/Toast'

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/** Global editor shortcuts: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redo, Delete/Backspace
 *  removes the current selection, Escape leaves connect mode / closes open popups. All disabled
 *  while focus is in a text input, so typing (e.g. renaming a stage) never triggers them. */
function useGlobalShortcuts() {
  const undo = useTreeStore((s) => s.undo)
  const redo = useTreeStore((s) => s.redo)
  const removeSelectedNodes = useTreeStore((s) => s.removeSelectedNodes)
  const removeSelectedEdge = useTreeStore((s) => s.removeSelectedEdge)
  const cancelConnect = useTreeStore((s) => s.cancelConnect)
  const closeDetail = useTreeStore((s) => s.closeDetail)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return
      const mod = e.metaKey || e.ctrlKey

      if (mod && !e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && !e.altKey && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useTreeStore.getState()
        if (state.selectedNodeIds.length > 0 || state.selectedNodeId) {
          e.preventDefault()
          removeSelectedNodes()
        } else if (state.selectedEdgeId) {
          e.preventDefault()
          removeSelectedEdge()
        }
        return
      }
      if (e.key === 'Escape') {
        const state = useTreeStore.getState()
        if (state.connectSourceId) {
          cancelConnect()
        } else if (state.isDetailOpen) {
          closeDetail()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo, removeSelectedNodes, removeSelectedEdge, cancelConnect, closeDetail])
}

export default function App() {
  const init = useTreeStore((s) => s.init)

  useEffect(() => {
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useGlobalShortcuts()

  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-full flex-col bg-[var(--ink-100)]">
        <Header />
        <Toolbar />
        <CanvasEditor />
        <ValidationBar />

        <NodeDetailDrawer />
        <NewTreeDialog />
        <Toast />
      </div>
    </ReactFlowProvider>
  )
}
