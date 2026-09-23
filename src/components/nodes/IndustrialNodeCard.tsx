import { memo, useCallback, useEffect } from 'react'
import { Handle, Position, useStore, useUpdateNodeInternals, type NodeProps } from '@xyflow/react'
import { getMasterNode } from '../../data/masterCatalog'
import { useTreeStore } from '../../store/useTreeStore'
import { statusDotClass } from '../../utils/statusStyle'
import { STATUS_LABEL } from '../../types'
import { NODE_CARD_HEIGHT, NODE_CARD_WIDTH } from '../../utils/layout'

export interface IndustrialNodeData {
  treeNodeId: string
  [key: string]: unknown
}

function IndustrialNodeCardImpl({ data, selected }: NodeProps) {
  const { treeNodeId } = data as IndustrialNodeData
  const treeNode = useTreeStore((s) => s.treeNodes.find((n) => n.id === treeNodeId))
  const mode = useTreeStore((s) => s.mode)
  const connectSourceId = useTreeStore((s) => s.connectSourceId)
  const openDetail = useTreeStore((s) => s.openDetail)
  const selectNode = useTreeStore((s) => s.selectNode)
  const toggleNodeInSelection = useTreeStore((s) => s.toggleNodeInSelection)
  const beginConnectFrom = useTreeStore((s) => s.beginConnectFrom)
  const requestConnection = useTreeStore((s) => s.requestConnection)
  const childCount = useTreeStore(
    (s) => s.edges.filter((e) => e.source === treeNodeId && e.target !== treeNodeId).length,
  )
  const isCollapsed = useTreeStore((s) => s.collapsedNodeIds.includes(treeNodeId))
  const toggleNodeCollapsed = useTreeStore((s) => s.toggleNodeCollapsed)

  const master = treeNode ? getMasterNode(treeNode.masterNodeId) : undefined

  // Handles are visually/hit-area rescaled to counter canvas zoom via the --handle-zoom-scale
  // CSS var (see index.css + CanvasEditor), which changes the handle DOM element's effective
  // size without React Flow's internal edge-anchor measurements knowing about it on their own.
  // Forcing a re-measure whenever zoom changes keeps edges from visually "sticking" at a stale
  // handle position after zooming.
  const zoom = useStore((s) => s.transform[2])
  const updateNodeInternals = useUpdateNodeInternals()
  useEffect(() => {
    updateNodeInternals(treeNodeId)
  }, [zoom, treeNodeId, updateNodeInternals])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (mode === 'connect') {
        if (!connectSourceId) {
          beginConnectFrom(treeNodeId)
        } else if (connectSourceId === treeNodeId) {
          selectNode(treeNodeId)
        } else {
          requestConnection(connectSourceId, treeNodeId, { x: e.clientX, y: e.clientY })
        }
        return
      }
      if (e.shiftKey) {
        toggleNodeInSelection(treeNodeId)
        return
      }
      selectNode(treeNodeId)
    },
    [mode, connectSourceId, treeNodeId, beginConnectFrom, requestConnection, selectNode, toggleNodeInSelection],
  )

  const handleToggleCollapsed = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      toggleNodeCollapsed(treeNodeId)
    },
    [toggleNodeCollapsed, treeNodeId],
  )

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      openDetail(treeNodeId, { x: e.clientX, y: e.clientY })
    },
    [openDetail, treeNodeId],
  )

  if (!treeNode || !master) return null

  const isConnectSource = connectSourceId === treeNodeId

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{ width: NODE_CARD_WIDTH, height: NODE_CARD_HEIGHT }}
      className={[
        'select-none border bg-[var(--paper)] text-left shadow-sm transition-shadow',
        selected
          ? 'border-[var(--selected)] ring-1 ring-[var(--selected)]'
          : isConnectSource
            ? 'border-[var(--ink-900)] ring-1 ring-[var(--ink-900)]'
            : 'border-[var(--ink-400)] hover:border-[var(--ink-700)]',
      ].join(' ')}
    >
      <Handle
        type="target"
        position={Position.Left}
      />
      <Handle
        type="source"
        position={Position.Right}
      />

      <div className="flex items-center justify-between bg-[var(--ink-900)] px-2.5 py-1.5 text-[var(--paper)]">
        <span className="font-technical text-[11px] tracking-wide">
          <span className="opacity-60">▦</span> {treeNode.editorState.priority}
        </span>
        <span className="font-technical text-[11px] font-semibold">{master.score.toFixed(1)}</span>
      </div>

      <div className="px-2.5 py-2">
        <div className="truncate text-[13px] font-semibold leading-snug text-[var(--ink-900)]">
          {master.name}
        </div>
        <div className="mt-1 font-technical text-[10.5px] text-[var(--ink-500)]">
          HS: {master.hsCode}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass(treeNode.editorState.status)}`} />
            <span className="truncate font-technical text-[10px] font-medium tracking-wide text-[var(--ink-600)]">
              {STATUS_LABEL[treeNode.editorState.status]}
            </span>
          </div>

          {childCount > 0 && (
            <button
              onClick={handleToggleCollapsed}
              title={isCollapsed ? `Expand ${childCount} turunan` : `Collapse ${childCount} turunan`}
              className="flex shrink-0 items-center gap-0.5 border border-[var(--ink-300)] bg-[var(--ink-50)] px-1 py-[1px] font-technical text-[10px] font-semibold text-[var(--ink-600)] hover:border-[var(--ink-700)] hover:text-[var(--ink-900)]"
            >
              <span>{isCollapsed ? '▸' : '▾'}</span>
              <span>{childCount}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export const IndustrialNodeCard = memo(IndustrialNodeCardImpl)
