import { memo, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getMasterNode } from '../../data/masterCatalog'
import { useTreeStore } from '../../store/useTreeStore'
import { statusDotClass } from '../../utils/statusStyle'
import { STATUS_LABEL } from '../../types'
import { NODE_CARD_WIDTH } from '../../utils/layout'

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
  const beginConnectFrom = useTreeStore((s) => s.beginConnectFrom)
  const requestConnection = useTreeStore((s) => s.requestConnection)

  const master = treeNode ? getMasterNode(treeNode.masterNodeId) : undefined

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (mode === 'connect') {
        if (!connectSourceId) {
          beginConnectFrom(treeNodeId)
        } else if (connectSourceId === treeNodeId) {
          selectNode(treeNodeId)
        } else {
          requestConnection(connectSourceId, treeNodeId)
        }
        return
      }
      selectNode(treeNodeId)
    },
    [mode, connectSourceId, treeNodeId, beginConnectFrom, requestConnection, selectNode],
  )

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      openDetail(treeNodeId)
    },
    [openDetail, treeNodeId],
  )

  if (!treeNode || !master) return null

  const isConnectSource = connectSourceId === treeNodeId

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{ width: NODE_CARD_WIDTH }}
      className={[
        'select-none border bg-[var(--paper)] text-left shadow-sm transition-shadow',
        selected
          ? 'border-[var(--signal-accent)] ring-1 ring-[var(--signal-accent)]'
          : isConnectSource
            ? 'border-[var(--ink-900)] ring-1 ring-[var(--ink-900)]'
            : 'border-[var(--ink-400)] hover:border-[var(--ink-700)]',
      ].join(' ')}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-[var(--ink-900)]"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-[var(--ink-900)]"
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
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass(treeNode.editorState.status)}`} />
          <span className="font-technical text-[10px] font-medium tracking-wide text-[var(--ink-600)]">
            {STATUS_LABEL[treeNode.editorState.status]}
          </span>
        </div>
      </div>
    </div>
  )
}

export const IndustrialNodeCard = memo(IndustrialNodeCardImpl)
