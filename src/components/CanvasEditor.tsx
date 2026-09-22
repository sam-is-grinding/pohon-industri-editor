import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  applyNodeChanges,
  type Node,
  type NodeChange,
  type Edge,
  type OnConnect,
  type OnConnectStart,
  type OnConnectEnd,
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
import { QuickAddNodePopover } from './panels/QuickAddNodePopover'
import {
  nearestStageOrder,
  NODE_CARD_HEIGHT,
  NODE_CARD_WIDTH,
  STAGE_COLUMN_WIDTH,
} from '../utils/layout'

const nodeTypes = { industrial: IndustrialNodeCard }

interface ContextMenuState {
  treeNodeId: string
  x: number
  y: number
}

interface QuickAddState {
  screenX: number
  screenY: number
  flowPosition: { x: number; y: number }
  stageId: string
  stageLabel: string
  connectFromId?: string | null
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
  const dropTreeNode = useTreeStore((s) => s.dropTreeNode)
  const requestConnection = useTreeStore((s) => s.requestConnection)

  const { screenToFlowPosition } = useReactFlow()

  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [stagePopover, setStagePopover] = useState<ContextMenuState | null>(null)
  const [openEdgeId, setOpenEdgeId] = useState<string | null>(null)
  const [quickAdd, setQuickAdd] = useState<QuickAddState | null>(null)

  // Tracks the node a connection-drag started from, so we can offer "add node" if it's
  // dropped on empty canvas instead of on another node's handle.
  const connectDragSourceRef = useRef<string | null>(null)

  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.order - b.order), [stages])

  // The "official" node list derived purely from the store: X is locked to each node's stage
  // column, Y is whatever was last committed. This only changes when the store actually
  // changes (add/remove/move/stage edits) — never on every drag pointermove.
  const storeNodes: Node[] = useMemo(
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
          // Explicit width/height (matching the rendered card) so the minimap always has
          // real dimensions to draw from immediately, instead of waiting on async DOM
          // measurement — without this, minimap entries can render as bare dots.
          width: NODE_CARD_WIDTH,
          height: NODE_CARD_HEIGHT,
          data: { treeNodeId: tn.id } satisfies IndustrialNodeData,
          selected: tn.id === selectedNodeId,
          draggable: mode !== 'connect',
          // Free-roaming horizontally: the node can be dragged across any stage column.
          // It snaps back to its (new) stage's centered column on drop — see onNodeDragStop.
        }
      }),
    [treeNodes, stages, selectedNodeId, mode],
  )

  // `nodes` is what actually gets rendered. It starts out equal to storeNodes and is kept in
  // sync with it via the effect below — EXCEPT while a drag is in progress, during which React
  // Flow's own internal drag engine updates it directly through onNodesChange. Routing drag
  // updates through this standard onNodesChange/applyNodeChanges pipeline (instead of a
  // separate piece of state fed manually from onNodeDrag) keeps nodes and their connected edges
  // reading from the exact same, single, in-sync array on every frame — which is what stops the
  // relationship lines from lagging/flickering behind the node while it's being dragged.
  const [nodes, setNodes] = useState<Node[]>(storeNodes)

  useEffect(() => {
    setNodes(storeNodes)
  }, [storeNodes])

  // Only let position/dimension changes (the ones driving drag + minimap accuracy) flow into
  // local state here — selection stays fully controlled by the store via `storeNodes` above,
  // same as before, so we don't open up a second, competing source of truth for it.
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const relevant = changes.filter((c) => c.type === 'position' || c.type === 'dimensions')
    if (relevant.length === 0) return
    setNodes((nds) => applyNodeChanges(relevant, nds))
  }, [])

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

  const onConnectStart: OnConnectStart = useCallback((_event, params) => {
    connectDragSourceRef.current = params.nodeId ?? null
  }, [])

  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      const sourceId = connectDragSourceRef.current
      connectDragSourceRef.current = null
      if (!sourceId) return

      const target = event.target as HTMLElement | null
      const droppedOnPane = !!target?.classList?.contains('react-flow__pane')
      if (!droppedOnPane) return

      const clientX = 'clientX' in event ? event.clientX : event.changedTouches?.[0]?.clientX ?? 0
      const clientY = 'clientY' in event ? event.clientY : event.changedTouches?.[0]?.clientY ?? 0

      const flowPosition = screenToFlowPosition({ x: clientX, y: clientY })
      const order = nearestStageOrder(flowPosition.x, sortedStages.length || 1)
      const stage = sortedStages[order]
      if (!stage) return

      setQuickAdd({
        screenX: clientX,
        screenY: clientY,
        flowPosition: { x: flowPosition.x, y: flowPosition.y - 40 },
        stageId: stage.id,
        stageLabel: `${stage.code} — ${stage.name}`,
        connectFromId: sourceId,
      })
    },
    [screenToFlowPosition, sortedStages],
  )

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      dropTreeNode(node.id, { x: node.position.x, y: node.position.y })
    },
    [dropTreeNode],
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

  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault()
      setContextMenu(null)
      setStagePopover(null)

      if (sortedStages.length === 0) return
      const flowPosition = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const order = nearestStageOrder(flowPosition.x, sortedStages.length)
      const stage = sortedStages[order]
      if (!stage) return

      setQuickAdd({
        screenX: e.clientX,
        screenY: e.clientY,
        flowPosition: { x: flowPosition.x, y: flowPosition.y - 40 },
        stageId: stage.id,
        stageLabel: `${stage.code} — ${stage.name}`,
        connectFromId: null,
      })
    },
    [screenToFlowPosition, sortedStages],
  )

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault()
    setQuickAdd(null)
    setContextMenu({ treeNodeId: node.id, x: e.clientX, y: e.clientY })
  }, [])

  const onMove = useCallback((_: unknown, vp: Viewport) => {
    setViewport(vp)
  }, [])

  return (
    <div className="relative flex-1 overflow-hidden bg-[var(--paper)]">
      <StageHeaderBar translateX={viewport.x} zoom={viewport.zoom} />

      <div className="relative h-[calc(100%-52px)] bg-[var(--paper)]">
        <StageColumnGuides translateX={viewport.x} zoom={viewport.zoom} />

        <ReactFlow
          nodes={nodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeClick={onEdgeClick}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          onMove={onMove}
          panOnScroll
          zoomOnScroll
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          className="rf-transparent-bg"
          defaultEdgeOptions={{ type: 'default' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--ink-300)" />
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

      {quickAdd && (
        <QuickAddNodePopover
          screenX={quickAdd.screenX}
          screenY={quickAdd.screenY}
          flowPosition={quickAdd.flowPosition}
          stageId={quickAdd.stageId}
          stageLabel={quickAdd.stageLabel}
          connectFromId={quickAdd.connectFromId}
          onClose={() => setQuickAdd(null)}
        />
      )}
    </div>
  )
}
