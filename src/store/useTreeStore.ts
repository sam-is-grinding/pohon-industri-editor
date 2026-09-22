import { create } from 'zustand'
import type {
  EditorMode,
  IndustrialEdge,
  NodeStatus,
  Priority,
  PublishStatus,
  RelationType,
  Stage,
  TreeNode,
  TreeSnapshot,
} from '../types'
import { getMasterNode } from '../data/masterCatalog'
import { buildTemplate, type TemplateId } from '../data/templates'
import { makeId } from '../utils/id'
import {
  defaultNodeY,
  NODE_CARD_WIDTH,
  nearestStageOrder,
  nodeXForStage,
  stageCode,
} from '../utils/layout'

const STORAGE_KEY = 'pohon-industri-draft-v1'
const HISTORY_LIMIT = 60

interface PersistedShape {
  treeName: string
  draftVersion: string
  publishStatus: PublishStatus
  stages: Stage[]
  treeNodes: TreeNode[]
  edges: IndustrialEdge[]
  collapsedNodeIds?: string[]
  savedAt: string
}

interface PendingConnection {
  sourceId: string
  targetId: string
  // Where (in screen/viewport px) the connection was made, so the Create Relationship popover
  // can open right there instead of always snapping to the center of the screen.
  screenX?: number
  screenY?: number
}

interface TreeStoreState {
  // ----- identity / lifecycle -----
  treeName: string
  draftVersion: string
  publishStatus: PublishStatus
  lastSavedAt: string | null
  hasUnsavedChanges: boolean

  // ----- domain data -----
  stages: Stage[]
  treeNodes: TreeNode[]
  edges: IndustrialEdge[]

  // ----- selection / UI mode -----
  mode: EditorMode
  selectedNodeId: string | null
  /** All canvas-highlighted nodes — a plain click sets this to a single id, box-select or
   *  shift-click can grow it. Dragging any node in here drags the whole group (see
   *  CanvasEditor's onNodeDragStop). */
  selectedNodeIds: string[]
  selectedEdgeId: string | null
  activeStageId: string | null

  // ----- view state -----
  /** Node ids whose downstream subtree is collapsed/hidden from the canvas. Purely a view
   *  preference — not part of undo history, but still saved with the draft. */
  collapsedNodeIds: string[]

  // ----- panels -----
  isDetailOpen: boolean
  isNewTreeOpen: boolean
  isValidationPanelOpen: boolean
  pendingConnection: PendingConnection | null
  connectSourceId: string | null

  // ----- history -----
  past: TreeSnapshot[]
  future: TreeSnapshot[]

  // ----- toast -----
  toast: string | null

  // ================= actions =================
  init: () => void
  createTree: (name: string, template: TemplateId) => void

  setMode: (mode: EditorMode) => void
  selectNode: (id: string | null) => void
  /** Replace the whole multi-selection (box-select drop, or a plain click passing a single id). */
  selectNodes: (ids: string[]) => void
  /** Shift-click convenience: add/remove one node from the current multi-selection. */
  toggleNodeInSelection: (id: string) => void
  selectEdge: (id: string | null) => void
  setActiveStage: (id: string | null) => void

  openDetail: (nodeId: string) => void
  closeDetail: () => void
  openNewTreeDialog: () => void
  closeNewTreeDialog: () => void
  toggleValidationPanel: () => void

  addNodeFromCatalog: (
    masterNodeId: string,
    stageId?: string,
    position?: { x: number; y: number },
  ) => string | null
  removeTreeNode: (treeNodeId: string) => void
  removeSelectedNodes: () => void
  duplicateTreeNode: (treeNodeId: string) => void
  moveTreeNode: (treeNodeId: string, position: { x: number; y: number }) => void
  dropTreeNode: (treeNodeId: string, position: { x: number; y: number }) => void
  /** Bulk version of dropTreeNode — used when a multi-node selection is dragged together, so
   *  the whole move lands as a single undo step instead of one per node. */
  dropTreeNodes: (updates: Array<{ id: string; position: { x: number; y: number } }>) => void
  changeNodeStage: (treeNodeId: string, stageId: string) => void
  changeNodeStatus: (treeNodeId: string, status: NodeStatus) => void
  changeNodePriority: (treeNodeId: string, priority: Priority) => void
  toggleNodeCollapse: (treeNodeId: string) => void

  beginConnectFrom: (treeNodeId: string) => void
  cancelConnect: () => void
  requestConnection: (
    sourceId: string,
    targetId: string,
    screenPos?: { x: number; y: number },
  ) => void
  confirmConnection: (relationType: RelationType) => void
  cancelConnection: () => void
  removeEdge: (edgeId: string) => void
  removeSelectedEdge: () => void

  addStage: () => void
  removeStage: (stageId: string) => void
  renameStage: (stageId: string, name: string) => void
  reorderStage: (stageId: string, direction: -1 | 1) => void

  undo: () => void
  redo: () => void

  saveDraft: () => void
  discardChanges: () => void
  publish: () => void

  showToast: (message: string) => void
  clearToast: () => void
}

function snapshotOf(state: TreeStoreState): TreeSnapshot {
  return {
    stages: state.stages,
    treeNodes: state.treeNodes,
    edges: state.edges,
  }
}

function defaultStages(): Stage[] {
  const names = ['Tambang', 'Konsentrat', 'Peleburan', 'Paduan', 'Antara']
  return names.map((name, order) => ({
    id: `stage-${stageCode(order)}`,
    code: stageCode(order),
    name,
    order,
  }))
}

function withMasterState(nodes: TreeNode[]): TreeNode[] {
  return nodes.map((n) => {
    const master = getMasterNode(n.masterNodeId)
    if (!master) return n
    return {
      ...n,
      editorState: { priority: master.priority, status: master.status },
    }
  })
}

function loadPersisted(): PersistedShape | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedShape
  } catch {
    return null
  }
}

export const useTreeStore = create<TreeStoreState>((set, get) => ({
  treeName: 'Untitled Industrial Tree',
  draftVersion: 'v1.0-draft-01',
  publishStatus: 'draft',
  lastSavedAt: null,
  hasUnsavedChanges: false,

  stages: defaultStages(),
  treeNodes: [],
  edges: [],

  mode: 'pan',
  selectedNodeId: null,
  selectedNodeIds: [],
  selectedEdgeId: null,
  activeStageId: null,

  collapsedNodeIds: [],

  isDetailOpen: false,
  isNewTreeOpen: false,
  isValidationPanelOpen: false,
  pendingConnection: null,
  connectSourceId: null,

  past: [],
  future: [],

  toast: null,

  init: () => {
    const persisted = loadPersisted()
    if (persisted) {
      set({
        treeName: persisted.treeName,
        draftVersion: persisted.draftVersion,
        publishStatus: persisted.publishStatus,
        stages: persisted.stages,
        treeNodes: persisted.treeNodes,
        edges: persisted.edges,
        collapsedNodeIds: persisted.collapsedNodeIds ?? [],
        lastSavedAt: persisted.savedAt,
        activeStageId: persisted.stages[0]?.id ?? null,
      })
      return
    }
    // First run: seed with the Example Nickel template so the canvas isn't empty.
    const built = buildTemplate('example_nickel')
    set({
      stages: built.stages,
      treeNodes: withMasterState(built.treeNodes),
      edges: built.edges,
      activeStageId: built.stages[0]?.id ?? null,
    })
  },

  createTree: (name, template) => {
    const built = buildTemplate(template)
    set({
      treeName: name.trim() || 'Untitled Industrial Tree',
      draftVersion: 'v1.0-draft-01',
      publishStatus: 'draft',
      stages: built.stages,
      treeNodes: withMasterState(built.treeNodes),
      edges: built.edges,
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
      collapsedNodeIds: [],
      activeStageId: built.stages[0]?.id ?? null,
      past: [],
      future: [],
      isNewTreeOpen: false,
      hasUnsavedChanges: true,
    })
    get().showToast(`Pohon "${name.trim() || 'Untitled Industrial Tree'}" dibuat`)
  },

  setMode: (mode) => set({ mode, connectSourceId: null }),
  selectNode: (id) =>
    set({
      selectedNodeId: id,
      selectedNodeIds: id ? [id] : [],
      selectedEdgeId: id ? null : get().selectedEdgeId,
    }),
  selectNodes: (ids) =>
    set({
      selectedNodeIds: ids,
      selectedNodeId: ids.length === 1 ? ids[0] : null,
      selectedEdgeId: ids.length > 0 ? null : get().selectedEdgeId,
    }),
  toggleNodeInSelection: (id) => {
    const state = get()
    const exists = state.selectedNodeIds.includes(id)
    const nextIds = exists ? state.selectedNodeIds.filter((x) => x !== id) : [...state.selectedNodeIds, id]
    set({
      selectedNodeIds: nextIds,
      selectedNodeId: nextIds.length === 1 ? nextIds[0] : null,
      selectedEdgeId: nextIds.length > 0 ? null : state.selectedEdgeId,
    })
  },
  selectEdge: (id) =>
    set({
      selectedEdgeId: id,
      selectedNodeId: id ? null : get().selectedNodeId,
      selectedNodeIds: id ? [] : get().selectedNodeIds,
    }),
  setActiveStage: (id) => set({ activeStageId: id }),

  openDetail: (nodeId) => set({ isDetailOpen: true, selectedNodeId: nodeId }),
  closeDetail: () => set({ isDetailOpen: false }),
  openNewTreeDialog: () => set({ isNewTreeOpen: true }),
  closeNewTreeDialog: () => set({ isNewTreeOpen: false }),
  toggleValidationPanel: () => set((s) => ({ isValidationPanelOpen: !s.isValidationPanelOpen })),

  addNodeFromCatalog: (masterNodeId, stageId, position) => {
    const state = get()
    const master = getMasterNode(masterNodeId)
    if (!master) return null
    const alreadyIn = state.treeNodes.some((n) => n.masterNodeId === masterNodeId)
    if (alreadyIn) {
      get().showToast(`${master.name} sudah ada di pohon`)
      return null
    }
    const targetStageId = stageId ?? state.activeStageId ?? state.stages[0]?.id
    if (!targetStageId) return null
    const stage = state.stages.find((s) => s.id === targetStageId)
    if (!stage) return null

    const siblings = state.treeNodes.filter((n) => n.stageId === targetStageId)
    const newNode: TreeNode = {
      id: makeId('tn'),
      masterNodeId,
      stageId: targetStageId,
      position: {
        x: nodeXForStage(stage.order),
        y: position?.y ?? defaultNodeY(siblings.length),
      },
      editorState: { priority: master.priority, status: master.status },
    }

    pushHistory(get, set)
    set({
      treeNodes: [...state.treeNodes, newNode],
      hasUnsavedChanges: true,
      selectedNodeId: newNode.id,
    })
    get().showToast(`${master.name} ditambahkan ke ${stage.code}`)
    return newNode.id
  },

  removeTreeNode: (treeNodeId) => {
    pushHistory(get, set)
    const state = get()
    set({
      treeNodes: state.treeNodes.filter((n) => n.id !== treeNodeId),
      edges: state.edges.filter((e) => e.source !== treeNodeId && e.target !== treeNodeId),
      selectedNodeId: state.selectedNodeId === treeNodeId ? null : state.selectedNodeId,
      selectedNodeIds: state.selectedNodeIds.filter((id) => id !== treeNodeId),
      collapsedNodeIds: state.collapsedNodeIds.filter((id) => id !== treeNodeId),
      isDetailOpen: state.selectedNodeId === treeNodeId ? false : state.isDetailOpen,
      hasUnsavedChanges: true,
    })
  },

  removeSelectedNodes: () => {
    const state = get()
    const idList = state.selectedNodeIds.length > 0
      ? state.selectedNodeIds
      : state.selectedNodeId
        ? [state.selectedNodeId]
        : []
    if (idList.length === 0) return
    const ids = new Set(idList)
    pushHistory(get, set)
    set({
      treeNodes: state.treeNodes.filter((n) => !ids.has(n.id)),
      edges: state.edges.filter((e) => !ids.has(e.source) && !ids.has(e.target)),
      collapsedNodeIds: state.collapsedNodeIds.filter((id) => !ids.has(id)),
      selectedNodeIds: [],
      selectedNodeId: null,
      isDetailOpen: state.selectedNodeId && ids.has(state.selectedNodeId) ? false : state.isDetailOpen,
      hasUnsavedChanges: true,
    })
    get().showToast(ids.size > 1 ? `${ids.size} node dihapus` : 'Node dihapus')
  },

  duplicateTreeNode: (treeNodeId) => {
    const state = get()
    const original = state.treeNodes.find((n) => n.id === treeNodeId)
    if (!original) return
    pushHistory(get, set)
    const clone: TreeNode = {
      ...original,
      id: makeId('tn'),
      position: { x: original.position.x + 24, y: original.position.y + 24 },
    }
    set({ treeNodes: [...state.treeNodes, clone], hasUnsavedChanges: true, selectedNodeId: clone.id })
    get().showToast('Node diduplikasi')
  },

  moveTreeNode: (treeNodeId, position) => {
    pushHistory(get, set)
    set((s) => ({
      treeNodes: s.treeNodes.map((n) => (n.id === treeNodeId ? { ...n, position } : n)),
      hasUnsavedChanges: true,
    }))
  },

  /** Called when a node drag ends: snaps the node into whichever stage column it was dropped nearest to. */
  dropTreeNode: (treeNodeId, position) => {
    const state = get()
    const node = state.treeNodes.find((n) => n.id === treeNodeId)
    if (!node) return
    const sortedStages = [...state.stages].sort((a, b) => a.order - b.order)
    if (sortedStages.length === 0) return

    const nodeCenterX = position.x + NODE_CARD_WIDTH / 2
    const order = nearestStageOrder(nodeCenterX, sortedStages.length)
    const stage = sortedStages[order]
    // No vertical clamping/snapping — the canvas is infinite in Y as well as X, nodes only
    // ever snap horizontally to the nearest stage column (above).

    pushHistory(get, set)
    set({
      treeNodes: state.treeNodes.map((n) =>
        n.id === treeNodeId
          ? { ...n, stageId: stage.id, position: { x: nodeXForStage(stage.order), y: position.y } }
          : n,
      ),
      hasUnsavedChanges: true,
    })
    if (stage.id !== node.stageId) {
      get().showToast(`Dipindahkan ke ${stage.code} — ${stage.name}`)
    }
  },

  /** Bulk drop for a multi-node group drag: every node snaps to its own nearest stage column,
   *  but the whole move is a single history entry instead of one push per node. */
  dropTreeNodes: (updates) => {
    if (updates.length === 0) return
    const state = get()
    const sortedStages = [...state.stages].sort((a, b) => a.order - b.order)
    if (sortedStages.length === 0) return

    const updateById = new Map(updates.map((u) => [u.id, u.position]))
    let movedStageCount = 0
    let lastStageLabel = ''

    const nextTreeNodes = state.treeNodes.map((n) => {
      const pos = updateById.get(n.id)
      if (!pos) return n
      const nodeCenterX = pos.x + NODE_CARD_WIDTH / 2
      const order = nearestStageOrder(nodeCenterX, sortedStages.length)
      const stage = sortedStages[order]
      if (stage.id !== n.stageId) {
        movedStageCount += 1
        lastStageLabel = `${stage.code} — ${stage.name}`
      }
      return { ...n, stageId: stage.id, position: { x: nodeXForStage(stage.order), y: pos.y } }
    })

    pushHistory(get, set)
    set({ treeNodes: nextTreeNodes, hasUnsavedChanges: true })

    if (movedStageCount === 1) {
      get().showToast(`Dipindahkan ke ${lastStageLabel}`)
    } else if (movedStageCount > 1) {
      get().showToast(`${movedStageCount} node dipindahkan ke stage baru`)
    }
  },

  changeNodeStage: (treeNodeId, stageId) => {
    const state = get()
    const stage = state.stages.find((s) => s.id === stageId)
    if (!stage) return
    pushHistory(get, set)
    set({
      treeNodes: state.treeNodes.map((n) =>
        n.id === treeNodeId
          ? { ...n, stageId, position: { x: nodeXForStage(stage.order), y: n.position.y } }
          : n,
      ),
      hasUnsavedChanges: true,
    })
  },

  changeNodeStatus: (treeNodeId, status) => {
    pushHistory(get, set)
    set((s) => ({
      treeNodes: s.treeNodes.map((n) =>
        n.id === treeNodeId ? { ...n, editorState: { ...n.editorState, status } } : n,
      ),
      hasUnsavedChanges: true,
    }))
  },

  changeNodePriority: (treeNodeId, priority) => {
    pushHistory(get, set)
    set((s) => ({
      treeNodes: s.treeNodes.map((n) =>
        n.id === treeNodeId ? { ...n, editorState: { ...n.editorState, priority } } : n,
      ),
      hasUnsavedChanges: true,
    }))
  },

  toggleNodeCollapse: (treeNodeId) => {
    const state = get()
    const isCollapsed = state.collapsedNodeIds.includes(treeNodeId)
    // A view-only toggle (what's hidden vs shown) — deliberately NOT pushed onto the undo
    // history, same as selection changes, so collapsing a branch doesn't clutter Undo.
    set({
      collapsedNodeIds: isCollapsed
        ? state.collapsedNodeIds.filter((id) => id !== treeNodeId)
        : [...state.collapsedNodeIds, treeNodeId],
    })
  },

  beginConnectFrom: (treeNodeId) => set({ mode: 'connect', connectSourceId: treeNodeId }),
  cancelConnect: () => set({ connectSourceId: null }),

  requestConnection: (sourceId, targetId, screenPos) => {
    if (sourceId === targetId) {
      get().showToast('Tidak bisa menghubungkan node ke dirinya sendiri')
      return
    }
    set({ pendingConnection: { sourceId, targetId, screenX: screenPos?.x, screenY: screenPos?.y } })
  },

  confirmConnection: (relationType) => {
    const state = get()
    const pending = state.pendingConnection
    if (!pending) return
    pushHistory(get, set)
    const newEdge: IndustrialEdge = {
      id: makeId('edge'),
      source: pending.sourceId,
      target: pending.targetId,
      relationType,
    }
    set({
      edges: [...state.edges, newEdge],
      pendingConnection: null,
      connectSourceId: null,
      hasUnsavedChanges: true,
    })
    get().showToast('Relasi dibuat')
  },

  cancelConnection: () => set({ pendingConnection: null }),

  removeEdge: (edgeId) => {
    pushHistory(get, set)
    set((s) => ({
      edges: s.edges.filter((e) => e.id !== edgeId),
      selectedEdgeId: s.selectedEdgeId === edgeId ? null : s.selectedEdgeId,
      hasUnsavedChanges: true,
    }))
  },

  removeSelectedEdge: () => {
    const id = get().selectedEdgeId
    if (!id) {
      get().showToast('Pilih relasi terlebih dahulu')
      return
    }
    get().removeEdge(id)
  },

  addStage: () => {
    pushHistory(get, set)
    const state = get()
    const order = state.stages.length
    const newStage: Stage = {
      id: makeId('stage'),
      code: stageCode(order),
      name: `Stage ${order}`,
      order,
    }
    set({ stages: [...state.stages, newStage], hasUnsavedChanges: true })
  },

  removeStage: (stageId) => {
    const state = get()
    if (state.stages.length <= 1) {
      get().showToast('Minimal harus ada satu stage')
      return
    }
    const nodesInStage = state.treeNodes.filter((n) => n.stageId === stageId)
    if (nodesInStage.length > 0) {
      get().showToast('Pindahkan atau hapus node di stage ini terlebih dahulu')
      return
    }
    pushHistory(get, set)
    const remaining = state.stages
      .filter((s) => s.id !== stageId)
      .sort((a, b) => a.order - b.order)
      .map((s, idx) => ({ ...s, order: idx, code: stageCode(idx) }))
    set({
      stages: remaining,
      treeNodes: reflowNodesToStages(state.treeNodes, remaining),
      activeStageId: state.activeStageId === stageId ? remaining[0]?.id ?? null : state.activeStageId,
      hasUnsavedChanges: true,
    })
  },

  renameStage: (stageId, name) => {
    pushHistory(get, set)
    set((s) => ({
      stages: s.stages.map((st) => (st.id === stageId ? { ...st, name } : st)),
      hasUnsavedChanges: true,
    }))
  },

  reorderStage: (stageId, direction) => {
    const state = get()
    const sorted = [...state.stages].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex((s) => s.id === stageId)
    const swapIdx = idx + direction
    if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return
    pushHistory(get, set)
    const reordered = [...sorted]
    ;[reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]]
    const withOrder = reordered.map((s, i) => ({ ...s, order: i, code: stageCode(i) }))
    set({
      stages: withOrder,
      treeNodes: reflowNodesToStages(state.treeNodes, withOrder),
      hasUnsavedChanges: true,
    })
  },

  undo: () => {
    const state = get()
    if (state.past.length === 0) return
    const previous = state.past[state.past.length - 1]
    const newPast = state.past.slice(0, -1)
    set({
      past: newPast,
      future: [snapshotOf(state), ...state.future].slice(0, HISTORY_LIMIT),
      stages: previous.stages,
      treeNodes: previous.treeNodes,
      edges: previous.edges,
      hasUnsavedChanges: true,
    })
  },

  redo: () => {
    const state = get()
    if (state.future.length === 0) return
    const next = state.future[0]
    const newFuture = state.future.slice(1)
    set({
      future: newFuture,
      past: [...state.past, snapshotOf(state)].slice(-HISTORY_LIMIT),
      stages: next.stages,
      treeNodes: next.treeNodes,
      edges: next.edges,
      hasUnsavedChanges: true,
    })
  },

  saveDraft: () => {
    const state = get()
    const savedAt = new Date().toISOString()
    const payload: PersistedShape = {
      treeName: state.treeName,
      draftVersion: state.draftVersion,
      publishStatus: state.publishStatus,
      stages: state.stages,
      treeNodes: state.treeNodes,
      edges: state.edges,
      collapsedNodeIds: state.collapsedNodeIds,
      savedAt,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      get().showToast('Gagal menyimpan draft (localStorage penuh?)')
      return
    }
    set({ lastSavedAt: savedAt, hasUnsavedChanges: false })
    get().showToast('Draft disimpan')
  },

  discardChanges: () => {
    const persisted = loadPersisted()
    if (!persisted) {
      get().showToast('Belum ada draft tersimpan')
      return
    }
    set({
      treeName: persisted.treeName,
      draftVersion: persisted.draftVersion,
      publishStatus: persisted.publishStatus,
      stages: persisted.stages,
      treeNodes: persisted.treeNodes,
      edges: persisted.edges,
      collapsedNodeIds: persisted.collapsedNodeIds ?? [],
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
      past: [],
      future: [],
      hasUnsavedChanges: false,
    })
    get().showToast('Perubahan dibatalkan')
  },

  publish: () => {
    set({ publishStatus: 'published' })
    get().saveDraft()
    get().showToast('Pohon berhasil dipublish')
  },

  showToast: (message) => {
    set({ toast: message })
  },
  clearToast: () => set({ toast: null }),
}))

function pushHistory(get: () => TreeStoreState, set: (partial: Partial<TreeStoreState>) => void) {
  const state = get()
  set({
    past: [...state.past, snapshotOf(state)].slice(-HISTORY_LIMIT),
    future: [],
  })
}

function reflowNodesToStages(nodes: TreeNode[], stages: Stage[]): TreeNode[] {
  return nodes.map((n) => {
    const stage = stages.find((s) => s.id === n.stageId)
    if (!stage) return n
    return { ...n, position: { ...n.position, x: nodeXForStage(stage.order) } }
  })
}
