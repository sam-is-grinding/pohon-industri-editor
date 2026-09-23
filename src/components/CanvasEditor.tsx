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
import { EdgeContextMenu } from './panels/EdgeContextMenu'
import { EdgeDetailDialog } from './panels/EdgeDetailDialog'
import { QuickAddNodePopover } from './panels/QuickAddNodePopover'
import {
  connectionRadiusForZoom,
  handleZoomScale,
  nearestStageOrder,
  NODE_CARD_HEIGHT,
  NODE_CARD_WIDTH,
  STAGE_COLUMN_WIDTH,
} from '../utils/layout'
import { computeHiddenNodeIds } from '../utils/visibility'

const nodeTypes = { industrial: IndustrialNodeCard }

interface ContextMenuState {
  treeNodeId: string
  x: number
  y: number
}

interface EdgeContextMenuState {
  edgeId: string
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

/** Rubber-band box-select rectangle, in coordinates local to the canvas wrapper (screen px). */
interface BoxSelectRect {
  x1: number
  y1: number
  x2: number
  y2: number
}

const BOX_SELECT_THRESHOLD_PX = 4

export function CanvasEditor() {
  const treeNodes = useTreeStore((s) => s.treeNodes)
  const edges = useTreeStore((s) => s.edges)
  const stages = useTreeStore((s) => s.stages)
  const mode = useTreeStore((s) => s.mode)
  const selectedNodeIds = useTreeStore((s) => s.selectedNodeIds)
  const selectedEdgeId = useTreeStore((s) => s.selectedEdgeId)
  const collapsedNodeIds = useTreeStore((s) => s.collapsedNodeIds)
  const selectNode = useTreeStore((s) => s.selectNode)
  const setSelectedNodeIds = useTreeStore((s) => s.setSelectedNodeIds)
  const addNodesToSelection = useTreeStore((s) => s.addNodesToSelection)
  const selectEdge = useTreeStore((s) => s.selectEdge)
  const dropTreeNode = useTreeStore((s) => s.dropTreeNode)
  const dropTreeNodes = useTreeStore((s) => s.dropTreeNodes)
  const requestConnection = useTreeStore((s) => s.requestConnection)

  const { screenToFlowPosition } = useReactFlow()

  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [edgeContextMenu, setEdgeContextMenu] = useState<EdgeContextMenuState | null>(null)
  const [openEdgeId, setOpenEdgeId] = useState<string | null>(null)
  const [quickAdd, setQuickAdd] = useState<QuickAddState | null>(null)
  const [boxSelect, setBoxSelect] = useState<BoxSelectRect | null>(null)

  // Tracks the node a connection-drag started from, so we can offer "add node" if it's
  // dropped on empty canvas instead of on another node's handle.
  const connectDragSourceRef = useRef<string | null>(null)

  // Right-click + hold + drag on the canvas = rubber-band box select (see the mousedown/move/up
  // listeners below). A plain right-click (no meaningful movement) still falls through to the
  // normal pane/node context menu instead.
  const wrapperRef = useRef<HTMLDivElement>(null)
  const rightDownRef = useRef<{ x: number; y: number; shift: boolean } | null>(null)
  const boxDraggingRef = useRef(false)
  const suppressContextMenuOpenRef = useRef(false)
  // Latest pointer position (screen px), kept up to date on every mousemove so drag-to-connect
  // (React Flow's onConnect, which carries no position of its own) can float the Create
  // Relationship popover at the point the connection was actually made.
  const lastPointerRef = useRef({ x: 0, y: 0 })

  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.order - b.order), [stages])

  // Nodes hidden by a collapsed ancestor (see utils/visibility) — recomputed only when the
  // underlying tree/collapse state actually changes.
  const hiddenNodeIds = useMemo(
    () => computeHiddenNodeIds(treeNodes, edges, new Set(collapsedNodeIds)),
    [treeNodes, edges, collapsedNodeIds],
  )

  // The "official" node list derived purely from the store: X is locked to each node's stage
  // column, Y is whatever was last committed. This only changes when the store actually
  // changes (add/remove/move/stage edits) — never on every drag pointermove.
  const storeNodes: Node[] = useMemo(
    () =>
      treeNodes
        .filter((tn) => !hiddenNodeIds.has(tn.id))
        .map((tn) => {
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
            // Driving React Flow's own multi-selection state (rather than just our own ring
            // styling) is what makes its built-in "drag one selected node, all selected nodes
            // move together" behavior kick in for free.
            selected: selectedNodeIds.includes(tn.id),
            draggable: mode !== 'connect',
            // Free-roaming horizontally: the node can be dragged across any stage column.
            // It snaps back to its (new) stage's centered column on drop — see onNodeDragStop.
          }
        }),
    [treeNodes, stages, selectedNodeIds, mode, hiddenNodeIds],
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
      edges
        .filter((e) => !hiddenNodeIds.has(e.source) && !hiddenNodeIds.has(e.target))
        .map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'default',
          selected: e.id === selectedEdgeId,
          style: {
            strokeWidth: e.id === selectedEdgeId ? 2.5 : 1.5,
            stroke: e.id === selectedEdgeId ? 'var(--selected)' : 'var(--ink-500)',
          },
          markerEnd: { type: 'arrowclosed' as const, color: 'var(--ink-500)', width: 16, height: 16 },
        })),
    [edges, selectedEdgeId, hiddenNodeIds],
  )

  const onConnect: OnConnect = useCallback(
    (params) => {
      if (!params.source || !params.target) return
      requestConnection(params.source, params.target, lastPointerRef.current)
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
      // If several nodes are selected and the one being dragged is among them, React Flow has
      // already moved all of them together (see `selected` on storeNodes above) — commit that as
      // one bulk drop/undo step instead of treating it as a single-node move.
      if (selectedNodeIds.length > 1 && selectedNodeIds.includes(node.id)) {
        const moves = nodes
          .filter((n) => selectedNodeIds.includes(n.id))
          .map((n) => ({ treeNodeId: n.id, position: { x: n.position.x, y: n.position.y } }))
        dropTreeNodes(moves)
        return
      }
      dropTreeNode(node.id, { x: node.position.x, y: node.position.y })
    },
    [dropTreeNode, dropTreeNodes, selectedNodeIds, nodes],
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
    setEdgeContextMenu(null)
  }, [selectNode, selectEdge])

  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault()
      // A right-click that turned into a box-select drag shouldn't also pop the "add node" menu.
      if (suppressContextMenuOpenRef.current) {
        suppressContextMenuOpenRef.current = false
        return
      }
      setContextMenu(null)
      setEdgeContextMenu(null)

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
    if (suppressContextMenuOpenRef.current) {
      suppressContextMenuOpenRef.current = false
      return
    }
    setQuickAdd(null)
    setEdgeContextMenu(null)
    setContextMenu({ treeNodeId: node.id, x: e.clientX, y: e.clientY })
  }, [])

  const onEdgeContextMenu: EdgeMouseHandler = useCallback((e, edge) => {
    e.preventDefault()
    e.stopPropagation()
    if (suppressContextMenuOpenRef.current) {
      suppressContextMenuOpenRef.current = false
      return
    }
    setQuickAdd(null)
    setContextMenu(null)
    setEdgeContextMenu({ edgeId: edge.id, x: e.clientX, y: e.clientY })
  }, [])

  // ---- Rubber-band box select: right-click + hold + drag on the canvas ----
  // Layered on top of (not instead of) the pane/node context menus above: a plain right-click
  // (no real movement) still opens the usual menu; only once the pointer has moved past the
  // threshold do we switch into box-select and suppress that upcoming context menu.
  useEffect(() => {
    function toLocal(clientX: number, clientY: number) {
      const rect = wrapperRef.current?.getBoundingClientRect()
      if (!rect) return { x: clientX, y: clientY }
      return { x: clientX - rect.left, y: clientY - rect.top }
    }

    function handleWindowMouseMove(e: MouseEvent) {
      lastPointerRef.current = { x: e.clientX, y: e.clientY }

      const start = rightDownRef.current
      if (!start) return
      const { x, y } = toLocal(e.clientX, e.clientY)
      if (!boxDraggingRef.current) {
        if (Math.abs(x - start.x) < BOX_SELECT_THRESHOLD_PX && Math.abs(y - start.y) < BOX_SELECT_THRESHOLD_PX) {
          return
        }
        boxDraggingRef.current = true
      }
      setBoxSelect({ x1: start.x, y1: start.y, x2: x, y2: y })
    }

    function handleWindowMouseUp(e: MouseEvent) {
      if (e.button !== 2) return
      const start = rightDownRef.current
      rightDownRef.current = null
      if (!start) return

      if (boxDraggingRef.current) {
        boxDraggingRef.current = false
        const { x, y } = toLocal(e.clientX, e.clientY)
        const selRect = {
          left: Math.min(start.x, x),
          right: Math.max(start.x, x),
          top: Math.min(start.y, y),
          bottom: Math.max(start.y, y),
        }
        const hitIds = nodes
          .filter((n) => {
            const nx1 = n.position.x * viewport.zoom + viewport.x
            const ny1 = n.position.y * viewport.zoom + viewport.y
            const nx2 = nx1 + NODE_CARD_WIDTH * viewport.zoom
            const ny2 = ny1 + NODE_CARD_HEIGHT * viewport.zoom
            return nx1 < selRect.right && nx2 > selRect.left && ny1 < selRect.bottom && ny2 > selRect.top
          })
          .map((n) => n.id)

        if (hitIds.length > 0) {
          if (start.shift) addNodesToSelection(hitIds)
          else setSelectedNodeIds(hitIds)
        } else if (!start.shift) {
          setSelectedNodeIds([])
        }

        setBoxSelect(null)
        // The browser's contextmenu event (and, downstream, our own pane/node context menu
        // handlers) fires right after this mouseup — swallow just that one.
        suppressContextMenuOpenRef.current = true
      }
    }

    window.addEventListener('mousemove', handleWindowMouseMove)
    window.addEventListener('mouseup', handleWindowMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove)
      window.removeEventListener('mouseup', handleWindowMouseUp)
    }
  }, [nodes, viewport, addNodesToSelection, setSelectedNodeIds])

  const onWrapperMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 2) return
    const rect = wrapperRef.current?.getBoundingClientRect()
    rightDownRef.current = {
      x: rect ? e.clientX - rect.left : e.clientX,
      y: rect ? e.clientY - rect.top : e.clientY,
      shift: e.shiftKey,
    }
    boxDraggingRef.current = false
  }, [])

  const onWrapperMouseMoveTracker = useCallback((e: React.MouseEvent) => {
    lastPointerRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  // ---- Context menu hardening (2nd and 3rd layer) ----
  // Layer 1 is onPaneContextMenu / onNodeContextMenu above (React Flow's own hooks). This
  // window-level capture listener is a backstop for right-clicks React Flow's handlers don't
  // see (minimap, controls, edges, empty margins, ...). We deliberately don't gate this on
  // e.button — reading `button` off a `contextmenu` event isn't reliable across browsers, and
  // `contextmenu` only ever fires for an actual context-menu gesture in the first place, so
  // there's nothing to check.
  useEffect(() => {
    function preventNativeMenu(e: MouseEvent) {
      e.preventDefault()
    }
    window.addEventListener('contextmenu', preventNativeMenu, true)
    return () => window.removeEventListener('contextmenu', preventNativeMenu, true)
  }, [])

  const onMove = useCallback((_: unknown, vp: Viewport) => {
    setViewport(vp)
  }, [])

  return (
    <div className="relative flex-1 overflow-hidden bg-[var(--paper)]">
      <StageHeaderBar translateX={viewport.x} zoom={viewport.zoom} />

      <div
        ref={wrapperRef}
        onMouseDown={onWrapperMouseDown}
        onMouseMove={onWrapperMouseMoveTracker}
        onContextMenu={(e) => e.preventDefault()}
        style={{ '--handle-zoom-scale': handleZoomScale(viewport.zoom) } as React.CSSProperties}
        className="relative h-[calc(100%-52px)] bg-[var(--paper)]"
      >
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
          onEdgeContextMenu={onEdgeContextMenu}
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          onMove={onMove}
          panOnScroll
          zoomOnScroll
          connectionRadius={connectionRadiusForZoom(viewport.zoom)}
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

        {boxSelect && (
          <div
            className="pointer-events-none absolute z-30 border border-dashed"
            style={{
              left: Math.min(boxSelect.x1, boxSelect.x2),
              top: Math.min(boxSelect.y1, boxSelect.y2),
              width: Math.abs(boxSelect.x2 - boxSelect.x1),
              height: Math.abs(boxSelect.y2 - boxSelect.y1),
              borderColor: 'var(--selected)',
              backgroundColor: 'rgba(91, 157, 245, 0.08)',
            }}
          />
        )}

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
        />
      )}

      {edgeContextMenu && (
        <EdgeContextMenu
          edgeId={edgeContextMenu.edgeId}
          x={edgeContextMenu.x}
          y={edgeContextMenu.y}
          onClose={() => setEdgeContextMenu(null)}
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
