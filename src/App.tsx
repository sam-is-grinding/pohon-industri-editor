import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useTreeStore } from './store/useTreeStore'
import { Header } from './components/Header'
import { Toolbar } from './components/Toolbar'
import { CanvasEditor } from './components/CanvasEditor'
import { ValidationBar } from './components/ValidationBar'
import { NodeCatalogPanel } from './components/panels/NodeCatalogPanel'
import { NodeDetailDrawer } from './components/panels/NodeDetailDrawer'
import { NewTreeDialog } from './components/panels/NewTreeDialog'
import { CreateRelationshipDialog } from './components/panels/CreateRelationshipDialog'
import { Toast } from './components/Toast'

export default function App() {
  const init = useTreeStore((s) => s.init)

  useEffect(() => {
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-full flex-col bg-[var(--ink-100)]">
        <Header />
        <Toolbar />
        <CanvasEditor />
        <ValidationBar />

        <NodeCatalogPanel />
        <NodeDetailDrawer />
        <NewTreeDialog />
        <CreateRelationshipDialog />
        <Toast />
      </div>
    </ReactFlowProvider>
  )
}
