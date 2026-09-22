import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  useUpdateNodeInternals,
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
import { computeHiddenNodeIds } from '../utils/visibility'
import {
  nearestStageOrder,
  NODE_CARD_HEIGHT,
  NODE_CARD_WIDTH,
  STAGE_COLUMN_WIDTH,
} from '../utils/layout'

const nodeTypes = { industrial: IndustrialNodeCard }

// How far (in screen px) the right mouse button has to travel, past its mousedown point, before
// we treat the gesture as "hold + drag" (rubber-band select) instead of a plain right-click.
const RIGHT_DRAG_THRESHOLD = 5

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

/** In-flight right-button drag gesture, tracked imperatively (not React state) so we don't
 *  re-subscribe window listeners on every pointer move. */
interface RightDragGesture {
  pointerId: number
  startX: number
  startY: number
  additive: boolean
  baseSelection: string[]
  moved: boolean
}

/** Screen-space rectangle currently being rubber-banded, only set once movement passes the
 *  threshold — this is what actually renders the dashed selection box. */
interface BoxSelectVisual {
  startClientX: number
  startClientY: number
  curClientX: number
  curClientY: number
}

export function CanvasEditor() {
  const treeNodes = useTreeStore((s) => s.treeNodes)
  const edges = useTreeStore((s) => s.edges)
  const stages = useTreeStore((s) => s.stages)
  const mode = useTreeStore((s) => s.mode)
  const setMode = useTreeStore((s) => s.setMode)
  const selectedNodeIds = useTreeStore((s) => s.selectedNodeIds)
  const selectedEdgeId = useTreeStore((s) => s.selectedEdgeId)
  const collapsedNodeIds = useTreeStore((s) => s.collapsedNodeIds)
  const selectNodes = useTreeStore((s) => s.selectNodes)
  const selectEdge = useTreeStore((s) => s.selectEdge)
  const dropTreeNodes = useTreeStore((s) => s.dropTreeNodes)
  const requestConnection = useTreeStore((s) => s.requestConnection)
  const removeSelectedNodes = useTreeStore((s) => s.removeSelectedNodes)
  const removeSelectedEdge = useTreeStore((s) => s.removeSelectedEdge)
  const undo = useTreeStore((s) => s.undo)
  const redo = useTreeStore((s) => s.redo)

  const { screenToFlowPosition } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()

  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [stagePopover, setStagePopover] = useState<ContextMenuState | null>(null)
  const [openEdgeId, setOpenEdgeId] = useState<string | null>(null)
  const [quickAdd, setQuickAdd] = useState<QuickAddState | null>(null)
  const [boxSelectVisual, setBoxSelectVisual] = useState<BoxSelectVisual | null>(null)

  const canvasWrapperRef = useRef<HTMLDivElement>(null)

  // Tracks the node a connection-drag started from, so we can offer "add node" if it's
  // dropped on empty canvas instead of on another node's handle.
  const connectDragSourceRef = useRef<string | null>(null)

  // Last known pointer position anywhere on screen — cheap to keep updated continuously, and
  // used to seed the Create Relationship popover's position when a connection is completed by
  // dragging from a handle (onConnect itself gets no event/position from React Flow).
  const lastPointerRef = useRef({ x: 0, y: 0 })

  // The in-progress right-click-hold-drag gesture (null when the right button isn't down).
  const rightDragRef = useRef<RightDragGesture | null>(null)

  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.order - b.order), [stages])

  // Nodes hidden because an ancestor is collapsed (see utils/visibility) — recomputed only when
  // the graph or the collapsed set actually changes.
  const hiddenNodeIds = useMemo(
    () => computeHiddenNodeIds(treeNodes, edges, collapsedNodeIds),
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
  //
  // It's also the source of truth for hit-testing the right-click-drag selection rectangle
  // (kept in a ref so the window pointer listeners below don't need to resubscribe on every
  // render just because a drag moved something).
  const [nodes, setNodes] = useState<Node[]>(storeNodes)
  const nodesRef = useRef<Node[]>(nodes)

  useEffect(() => {
    setNodes(storeNodes)
  }, [storeNodes])

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

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

  // Fires for both a solo drag and a multi-node group drag — React Flow always hands back the
  // full list of nodes that were actually dragged (everything selected, plus the one grabbed),
  // so this one handler covers "drag one node" and "drag the whole multi-selection together"
  // without needing to special-case either.
  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, node, draggedNodes) => {
      const list = draggedNodes && draggedNodes.length > 0 ? draggedNodes : [node]
      dropTreeNodes(list.map((n) => ({ id: n.id, position: { x: n.position.x, y: n.position.y } })))
    },
    [dropTreeNodes],
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
    selectNodes([])
    selectEdge(null)
    setContextMenu(null)
    setStagePopover(null)
    if (mode === 'connect') setMode('pan')
  }, [selectNodes, selectEdge, mode, setMode])

  // Handles are scaled inversely with zoom (see --handle-zoom-scale / .react-flow__handle in
  // index.css) so their ON-SCREEN size stays constant regardless of zoom. The side effect: their
  // flow-space box size literally changes every time zoom changes. React Flow only recomputes a
  // node's handle anchor points (which is what edges attach to) when it's explicitly told that
  // node's internals changed — it has no way to know our CSS just resized a handle purely
  // because the viewport zoomed. Without telling it, an edge keeps pointing at the handle's
  // stale pre-zoom anchor until something else (e.g. dragging the node) happens to force a
  // remeasure — exactly the "edge stays offset at the old size until you nudge the node" bug.
  // So: whenever zoom actually changes, explicitly ask React Flow to remeasure every node.
  const lastZoomRef = useRef(viewport.zoom)
  const onMove = useCallback(
    (_: unknown, vp: Viewport) => {
      setViewport(vp)
      if (vp.zoom !== lastZoomRef.current) {
        lastZoomRef.current = vp.zoom
        updateNodeInternals(nodesRef.current.map((n) => n.id))
      }
    },
    [updateNodeInternals],
  )

  // ---------------------------------------------------------------------------------------
  // Right-click + hold + drag => rubber-band multi-select.
  //
  // Prevention of the native browser menu is delegated to React Flow's own onPaneContextMenu /
  // onNodeContextMenu props below — NOT a hand-rolled capture listener on a wrapper div. That
  // custom-capture approach used to live here and reliably leaked the native menu through on
  // real-world testing; React Flow attaches these two callbacks directly to the actual pane/node
  // DOM elements itself, and calling preventDefault() from inside them is what the earlier,
  // simpler version of this app relied on and never had this problem — so we go back to that
  // as the actual suppression mechanism, and only use it purely to preventDefault (no popup
  // logic in here), because at the moment `contextmenu` fires we don't yet know if this is going
  // to turn into a drag (mousemove/up haven't happened yet). What a right-click gesture actually
  // resolves to (open the node menu / open quick-add / do nothing because it was a drag) is
  // decided once the gesture is over, in handlePointerUp below, exactly as before.
  // ---------------------------------------------------------------------------------------
  const sortedStagesRef = useRef(sortedStages)
  useEffect(() => {
    sortedStagesRef.current = sortedStages
  }, [sortedStages])

  const screenToFlowPositionRef = useRef(screenToFlowPosition)
  useEffect(() => {
    screenToFlowPositionRef.current = screenToFlowPosition
  }, [screenToFlowPosition])

  const resolveRightClickRef = useRef<(clientX: number, clientY: number) => void>(() => { })
  resolveRightClickRef.current = (clientX, clientY) => {
    const nodeEl = document.elementFromPoint(clientX, clientY)?.closest('.react-flow__node')
    const nodeId = nodeEl?.getAttribute('data-id')
    if (nodeId) {
      setQuickAdd(null)
      setStagePopover(null)
      setContextMenu({ treeNodeId: nodeId, x: clientX, y: clientY })
      return
    }

    setContextMenu(null)
    setStagePopover(null)

    const stages_ = sortedStagesRef.current
    if (stages_.length === 0) return
    const flowPosition = screenToFlowPositionRef.current({ x: clientX, y: clientY })
    const order = nearestStageOrder(flowPosition.x, stages_.length)
    const stage = stages_[order]
    if (!stage) return

    setQuickAdd({
      screenX: clientX,
      screenY: clientY,
      flowPosition: { x: flowPosition.x, y: flowPosition.y - 40 },
      stageId: stage.id,
      stageLabel: `${stage.code} — ${stage.name}`,
      connectFromId: null,
    })
  }

  useEffect(() => {
    function handlePointerMove(e: PointerEvent) {
      lastPointerRef.current = { x: e.clientX, y: e.clientY }

      const gesture = rightDragRef.current
      if (!gesture || e.pointerId !== gesture.pointerId) return

      if (!gesture.moved) {
        const dx = e.clientX - gesture.startX
        const dy = e.clientY - gesture.startY
        if (Math.hypot(dx, dy) < RIGHT_DRAG_THRESHOLD) return
        gesture.moved = true
      }

      setBoxSelectVisual({
        startClientX: gesture.startX,
        startClientY: gesture.startY,
        curClientX: e.clientX,
        curClientY: e.clientY,
      })

      const p1 = screenToFlowPosition({ x: gesture.startX, y: gesture.startY })
      const p2 = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const minX = Math.min(p1.x, p2.x)
      const maxX = Math.max(p1.x, p2.x)
      const minY = Math.min(p1.y, p2.y)
      const maxY = Math.max(p1.y, p2.y)

      const overlappingIds = nodesRef.current
        .filter((n) => {
          const x1 = n.position.x
          const y1 = n.position.y
          const x2 = x1 + (n.width ?? NODE_CARD_WIDTH)
          const y2 = y1 + (n.height ?? NODE_CARD_HEIGHT)
          return x1 <= maxX && x2 >= minX && y1 <= maxY && y2 >= minY
        })
        .map((n) => n.id)

      const finalIds = gesture.additive
        ? Array.from(new Set([...gesture.baseSelection, ...overlappingIds]))
        : overlappingIds

      selectNodes(finalIds)
    }

    function handlePointerUp(e: PointerEvent) {
      const gesture = rightDragRef.current
      if (!gesture || e.pointerId !== gesture.pointerId) return
      rightDragRef.current = null
      setBoxSelectVisual(null)
      if (!gesture.moved) {
        // No real drag happened — treat it as a plain right-click (the native contextmenu
        // event for it was already swallowed via onPaneContextMenu/onNodeContextMenu) and
        // resolve it ourselves instead.
        resolveRightClickRef.current(e.clientX, e.clientY)
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [screenToFlowPosition, selectNodes])

  const onCanvasPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 2) return

      e.preventDefault()

      rightDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        additive: e.shiftKey,
        baseSelection: selectedNodeIds,
        moved: false,
      }
    },
    [selectedNodeIds],
  )

  // Chromium/Firefox/Safari all fire `contextmenu` before we can know whether the gesture will
  // turn into a drag, so these two just swallow the native menu immediately and unconditionally
  // — same as the previous, reliable version of this app. They don't decide what to show; that
  // happens in handlePointerUp once we know whether the button moved.
  const onPaneContextMenu = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.preventDefault()
  }, [])

  const onNodeContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  // Belt-and-suspenders layer for the empty-canvas case: a genuine native, capture-phase
  // `contextmenu` listener on window, completely independent of React Flow's own prop wiring.
  //
  // Bug that was here before: this used to gate on `if (e.button === 2)` before calling
  // preventDefault(). That check is wrong for a `contextmenu` event specifically — `.button` on
  // `contextmenu` is unreliable across browsers (often 0, not 2, even for a genuine right-click),
  // so the condition silently failed and preventDefault() never actually ran. That's exactly why
  // it only ever leaked on empty canvas: node right-clicks were still caught by
  // onNodeContextMenu (unconditional, no button check), but empty-canvas clicks had nothing else
  // backing them up once this conditional silently no-opped. Fix: never gate a `contextmenu`
  // handler on `.button` — always prevent it unconditionally, the same way onPaneContextMenu/
  // onNodeContextMenu above already do.
  useEffect(() => {
    const preventBrowserContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }

    window.addEventListener('contextmenu', preventBrowserContextMenu, {
      capture: true,
      passive: false,
    })

    return () => {
      window.removeEventListener('contextmenu', preventBrowserContextMenu, { capture: true })
    }
  }, [])

  // ---------------------------------------------------------------------------------------
  // Delete key => remove whatever's selected. Escape => cancel connect-mode / dismiss popups.
  // Guarded against text inputs so renaming a stage or typing in a search box doesn't also
  // delete a node sitting behind it.
  // ---------------------------------------------------------------------------------------
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const isTextEntry =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!target?.isContentEditable
      if (isTextEntry) return

      // Ctrl+Z / Cmd+Z => undo. Ctrl+Shift+Z / Cmd+Shift+Z => redo (also accepts the
      // Ctrl+Y convention some people reach for out of habit).
      const isUndoRedoModifier = e.ctrlKey || e.metaKey
      if (isUndoRedoModifier && !e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (isUndoRedoModifier && !e.altKey && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeIds.length > 0) {
          e.preventDefault()
          removeSelectedNodes()
        } else if (selectedEdgeId) {
          e.preventDefault()
          removeSelectedEdge()
        }
      } else if (e.key === 'Escape') {
        if (mode === 'connect') setMode('pan')
        setBoxSelectVisual(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    selectedNodeIds,
    selectedEdgeId,
    removeSelectedNodes,
    removeSelectedEdge,
    mode,
    setMode,
    undo,
    redo,
  ])

  

  // The handle lives inside `.react-flow__viewport`, which React Flow itself scales with a CSS
  // `transform: scale(zoom)`. To keep the handle's ON-SCREEN size (both the visible dot and its
  // wider hit/hover area) constant at any zoom level, their flow-space size must scale by the
  // inverse, `1 / zoom` — the two cancel out exactly. See the `.react-flow__handle` rules in
  // index.css that consume this as --handle-zoom-scale.
  const handleZoomScale = 1 / viewport.zoom

  // React Flow's own "how close do I need to be to grab/snap onto a handle" radius
  // (`connectionRadius`, in flow-space units, default 20) suffers the exact same problem: at a
  // fixed value it gets easier to hit when zoomed in and much harder when zoomed out. Scaling it
  // by the same inverse-zoom factor keeps starting/finishing a relationship equally easy no
  // matter how zoomed out the canvas is.
  const connectionRadius = 20 * handleZoomScale

  return (
    <div className="relative flex-1 overflow-hidden bg-[var(--paper)]">
      <StageHeaderBar translateX={viewport.x} zoom={viewport.zoom} />

      <div
        ref={canvasWrapperRef}
        className="relative h-[calc(100%-52px)] bg-[var(--paper)]"
        style={{ '--handle-zoom-scale': handleZoomScale } as React.CSSProperties}
        onPointerDown={onCanvasPointerDown}
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
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          onMove={onMove}
          panOnScroll
          zoomOnScroll
          minZoom={0.3}
          maxZoom={2}
          connectionRadius={connectionRadius}
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

        {boxSelectVisual &&
          (() => {
            const rect = canvasWrapperRef.current?.getBoundingClientRect()
            const offsetX = rect?.left ?? 0
            const offsetY = rect?.top ?? 0
            const left = Math.min(boxSelectVisual.startClientX, boxSelectVisual.curClientX) - offsetX
            const top = Math.min(boxSelectVisual.startClientY, boxSelectVisual.curClientY) - offsetY
            const width = Math.abs(boxSelectVisual.curClientX - boxSelectVisual.startClientX)
            const height = Math.abs(boxSelectVisual.curClientY - boxSelectVisual.startClientY)
            return (
              <div
                className="pointer-events-none absolute z-30 border border-dashed border-[var(--selected)] bg-[var(--selected)]/10"
                style={{ left, top, width, height }}
              />
            )
          })()}

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
