import { useCallback, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnConnect,
  type OnNodeDrag,
  type Viewport,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useTreeStore } from '../store/useTreeStore'
import { IndustrialNodeCard, type IndustrialNodeData } from './nodes/IndustrialNodeCard'
import { StageHeaderBar } from './StageHeaderBar'
import { StageColumnGuides } from './StageColumnGuides'
import { NodeContextMenu } from './panels/NodeContextMenu'
import { ChangeStagePopover } from './panels/ChangeStagePopover'
import { EdgeDetailDialog } from './panels/EdgeDetailDialog'
import { NODE_CARD_WIDTH, STAGE_COLUMN_WIDTH } from '../utils/layout'

const nodeTypes = { industrial: IndustrialNodeCard }

interface ContextMenuState {
  treeNodeId: string
  x: number
  y: number
}

export function CanvasEditor() {
  const treeNodes = useTreeStore((s) => s.treeNodes)
  const edges = useTreeStore((s) => s.edges)
  const stages = useTreeStore((s) => s.stages)
  const mode = useTreeStore((s) => s.mode)
  const selectedNodeId = useTreeStore((s) => s.selectedNodeId)
  const selectedEdgeId = useTreeStore((s) => s.selectedEdgeId)
  const selectNode = useTreeStore((s) => s.selectNode)
  const selectEdge = useTreeStore((s) => s.selectEdge)
  const moveTreeNode = useTreeStore((s) => s.moveTreeNode)
  const requestConnection = useTreeStore((s) => s.requestConnection)

  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [stagePopover, setStagePopover] = useState<ContextMenuState | null>(null)
  const [openEdgeId, setOpenEdgeId] = useState<string | null>(null)

  const rfNodes: Node[] = useMemo(
    () =>
      treeNodes.map((tn) => {
        const stage = stages.find((s) => s.id === tn.stageId)
        const x = stage
          ? stage.order * STAGE_COLUMN_WIDTH + (STAGE_COLUMN_WIDTH - NODE_CARD_WIDTH) / 2
          : tn.position.x
        return {
          id: tn.id,
          type: 'industrial',
          position: { x, y: tn.position.y },
          data: { treeNodeId: tn.id } satisfies IndustrialNodeData,
          selected: tn.id === selectedNodeId,
          draggable: mode !== 'connect',
          extent: [
            [x, -20000],
            [x, 20000],
          ] as [[number, number], [number, number]],
        }
      }),
    [treeNodes, stages, selectedNodeId, mode],
  )

  const rfEdges: Edge[] = useMemo(
    () =>
      edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'default',
        selected: e.id === selectedEdgeId,
        style: {
          strokeWidth: e.id === selectedEdgeId ? 2.5 : 1.5,
          stroke: e.id === selectedEdgeId ? 'var(--signal-accent)' : 'var(--ink-500)',
        },
        markerEnd: { type: 'arrowclosed' as const, color: 'var(--ink-500)', width: 16, height: 16 },
      })),
    [edges, selectedEdgeId],
  )

  const onConnect: OnConnect = useCallback(
    (params) => {
      if (!params.source || !params.target) return
      requestConnection(params.source, params.target)
    },
    [requestConnection],
  )

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      moveTreeNode(node.id, { x: node.position.x, y: node.position.y })
    },
    [moveTreeNode],
  )

  const onNodeClick: NodeMouseHandler = useCallback(() => {
    // selection is handled inside IndustrialNodeCard for connect-mode logic
  }, [])

  const onEdgeClick: EdgeMouseHandler = useCallback(
    (e, edge) => {
      e.stopPropagation()
      selectEdge(edge.id)
    },
    [selectEdge],
  )

  const onEdgeDoubleClick: EdgeMouseHandler = useCallback((e, edge) => {
    e.stopPropagation()
    setOpenEdgeId(edge.id)
  }, [])

  const onPaneClick = useCallback(() => {
    selectNode(null)
    selectEdge(null)
    setContextMenu(null)
    setStagePopover(null)
  }, [selectNode, selectEdge])

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault()
    setContextMenu({ treeNodeId: node.id, x: e.clientX, y: e.clientY })
  }, [])

  const onMove = useCallback((_: unknown, vp: Viewport) => {
    setViewport(vp)
    // keep active stage roughly in sync with what's visible isn't required; left manual
  }, [])

  return (
    <div className="relative flex-1 overflow-hidden">
      <StageHeaderBar translateX={viewport.x} zoom={viewport.zoom} />

      <div className="relative h-[calc(100%-52px)]">
        <StageColumnGuides translateX={viewport.x} translateY={viewport.y} zoom={viewport.zoom} />

        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeClick={onEdgeClick}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onPaneClick={onPaneClick}
          onMove={onMove}
          panOnScroll
          zoomOnScroll
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          className="rf-dotted-bg"
          defaultEdgeOptions={{ type: 'default' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={0} color="transparent" />
          <Controls showInteractive={false} position="bottom-right" />
          <MiniMap
            position="bottom-left"
            pannable
            zoomable
            nodeColor="var(--ink-400)"
            maskColor="rgba(10,10,11,0.06)"
            style={{ width: 160, height: 110 }}
          />
        </ReactFlow>

        <div className="pointer-events-none absolute bottom-[122px] left-2 font-technical text-[9px] uppercase tracking-wider text-[var(--ink-400)]">
          Minimap
        </div>
      </div>

      {contextMenu && (
        <NodeContextMenu
          treeNodeId={contextMenu.treeNodeId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onChangeStage={() => setStagePopover(contextMenu)}
        />
      )}

      {stagePopover && (
        <ChangeStagePopover
          treeNodeId={stagePopover.treeNodeId}
          x={stagePopover.x}
          y={stagePopover.y}
          onClose={() => setStagePopover(null)}
        />
      )}

      {openEdgeId && <EdgeDetailDialog edgeId={openEdgeId} onClose={() => setOpenEdgeId(null)} />}
    </div>
  )
}
