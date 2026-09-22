import { memo, useCallback, useMemo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getMasterNode } from '../../data/masterCatalog'
import { useTreeStore } from '../../store/useTreeStore'
import { statusDotClass } from '../../utils/statusStyle'
import { STATUS_LABEL } from '../../types'
import { NODE_CARD_HEIGHT, NODE_CARD_WIDTH } from '../../utils/layout'
import { countDirectChildren } from '../../utils/visibility'

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
  const edges = useTreeStore((s) => s.edges)
  const isCollapsed = useTreeStore((s) => s.collapsedNodeIds.includes(treeNodeId))
  const toggleNodeCollapse = useTreeStore((s) => s.toggleNodeCollapse)

  const master = treeNode ? getMasterNode(treeNode.masterNodeId) : undefined

  const childCount = useMemo(() => countDirectChildren(treeNodeId, edges), [treeNodeId, edges])

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
      // Shift-click adds/removes this node from the current multi-selection (handy for
      // building up a selection by hand alongside the right-click-drag rubber band); a plain
      // click replaces the selection with just this node.
      if (e.shiftKey) {
        toggleNodeInSelection(treeNodeId)
      } else {
        selectNode(treeNodeId)
      }
    },
    [
      mode,
      connectSourceId,
      treeNodeId,
      beginConnectFrom,
      requestConnection,
      selectNode,
      toggleNodeInSelection,
    ],
  )

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      openDetail(treeNodeId)
    },
    [openDetail, treeNodeId],
  )

  const handleToggleCollapse = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      toggleNodeCollapse(treeNodeId)
    },
    [toggleNodeCollapse, treeNodeId],
  )

  if (!treeNode || !master) return null

  const isConnectSource = connectSourceId === treeNodeId

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{ width: NODE_CARD_WIDTH, height: NODE_CARD_HEIGHT }}
      className={[
        'relative select-none overflow-visible border bg-[var(--paper)] text-left shadow-sm transition-shadow',
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

      <div className="overflow-hidden">
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
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass(treeNode.editorState.status)}`} />
            <span className="font-technical text-[10px] font-medium tracking-wide text-[var(--ink-600)]">
              {STATUS_LABEL[treeNode.editorState.status]}
            </span>
          </div>
        </div>
      </div>

      {childCount > 0 && (
        <button
          onClick={handleToggleCollapse}
          title={
            isCollapsed
              ? `Tampilkan ${childCount} simpul turunan`
              : `Sembunyikan ${childCount} simpul turunan agar canvas tidak penuh`
          }
          // Sits beside the right-side connection handle (offset down a touch so it doesn't
          // overlap the handle's hit area) instead of hanging off the bottom edge.
          className="absolute -right-2 top-1/2 z-10 flex translate-x-full translate-y-3 items-center gap-1 rounded-full border border-[var(--ink-400)] bg-[var(--paper)] px-1.5 py-0.5 font-technical text-[9.5px] font-medium text-[var(--ink-600)] shadow-sm hover:border-[var(--ink-800)] hover:text-[var(--ink-900)]"
        >
          <span>{isCollapsed ? '▸' : '▾'}</span>
          <span>{childCount}</span>
        </button>
      )}
    </div>
  )
}

export const IndustrialNodeCard = memo(IndustrialNodeCardImpl)
