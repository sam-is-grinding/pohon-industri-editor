import { create } from 'zustand'
import type {
  EditorMode,
  IndustrialEdge,
  NodeStatus,
  Priority,
  PublishStatus,
  Stage,
  TreeNode,
  TreeSnapshot,
} from '../types'
import { getMasterNode } from '../data/masterCatalog'
import { DEFAULT_RELATION_TYPE } from '../types'
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
  savedAt: string
  // View preference, not domain data — persisted alongside the draft but never pushed onto the
  // undo/redo history (see pushHistory / snapshotOf below, which only track stages/treeNodes/edges).
  collapsedNodeIds?: string[]
}

interface DetailPosition {
  screenX: number
  screenY: number
}

export interface NodeMove {
  treeNodeId: string
  position: { x: number; y: number }
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
  /** All currently-selected nodes; selectedNodeId mirrors its last entry for single-node UI. */
  selectedNodeIds: string[]
  selectedEdgeId: string | null
  activeStageId: string | null

  // ----- view preferences -----
  /** Node ids whose subtree is collapsed. Persisted, but intentionally excluded from undo/redo. */
  collapsedNodeIds: string[]

  // ----- panels -----
  isDetailOpen: boolean
  isNewTreeOpen: boolean
  isValidationPanelOpen: boolean
  connectSourceId: string | null
  /** Screen position (viewport px) the Node Detail panel should open centered on — mirrors how
   *  the Quick Add popover floats around the mouse. Null falls back to a sensible default. */
  detailPosition: DetailPosition | null

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
  /** Shift+click: toggles a single node's membership in the current multi-selection. */
  toggleNodeInSelection: (id: string) => void
  /** Replaces the whole selection wholesale (used by rubber-band box select). */
  setSelectedNodeIds: (ids: string[]) => void
  /** Adds ids to the current selection without clearing it (Shift + box select). */
  addNodesToSelection: (ids: string[]) => void
  selectEdge: (id: string | null) => void
  setActiveStage: (id: string | null) => void

  toggleNodeCollapsed: (nodeId: string) => void

  /** screenPos, when given, is where the panel should open centered (e.g. the click/double-click
   *  that triggered it) — mirrors the Quick Add popover's behavior instead of always docking. */
  openDetail: (nodeId: string, screenPos?: { x: number; y: number }) => void
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
  /** Deletes every node currently in selectedNodeIds (falling back to selectedNodeId) as one step. */
  removeSelectedNodes: () => void
  moveTreeNode: (treeNodeId: string, position: { x: number; y: number }) => void
  dropTreeNode: (treeNodeId: string, position: { x: number; y: number }) => void
  /** Drops several nodes (a multi-selection drag) in a single undo step; each snaps to its own nearest stage column. */
  dropTreeNodes: (moves: NodeMove[]) => void
  changeNodeStage: (treeNodeId: string, stageId: string) => void
  changeNodeStatus: (treeNodeId: string, status: NodeStatus) => void
  changeNodePriority: (treeNodeId: string, priority: Priority) => void

  beginConnectFrom: (treeNodeId: string) => void
  cancelConnect: () => void
  requestConnection: (sourceId: string, targetId: string, screenPos?: { x: number; y: number }) => void
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

  mode: 'select',
  selectedNodeId: null,
  selectedNodeIds: [],
  selectedEdgeId: null,
  activeStageId: null,

  collapsedNodeIds: [],

  isDetailOpen: false,
  isNewTreeOpen: false,
  isValidationPanelOpen: false,
  connectSourceId: null,
  detailPosition: null,

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
        lastSavedAt: persisted.savedAt,
        activeStageId: persisted.stages[0]?.id ?? null,
        collapsedNodeIds: persisted.collapsedNodeIds ?? [],
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
      activeStageId: built.stages[0]?.id ?? null,
      collapsedNodeIds: [],
      past: [],
      future: [],
      isNewTreeOpen: false,
      hasUnsavedChanges: true,
    })
    get().showToast(`Pohon "${name.trim() || 'Untitled Industrial Tree'}" dibuat`)
  },

  setMode: (mode) => set({ mode, connectSourceId: null }),
  selectNode: (id) =>
    set((s) => ({
      selectedNodeId: id,
      selectedNodeIds: id ? [id] : [],
      selectedEdgeId: id ? null : s.selectedEdgeId,
    })),
  toggleNodeInSelection: (id) =>
    set((s) => {
      const exists = s.selectedNodeIds.includes(id)
      const nextIds = exists ? s.selectedNodeIds.filter((n) => n !== id) : [...s.selectedNodeIds, id]
      return {
        selectedNodeIds: nextIds,
        selectedNodeId: nextIds.length > 0 ? nextIds[nextIds.length - 1] : null,
        selectedEdgeId: nextIds.length > 0 ? null : s.selectedEdgeId,
      }
    }),
  setSelectedNodeIds: (ids) =>
    set((s) => ({
      selectedNodeIds: ids,
      selectedNodeId: ids.length > 0 ? ids[ids.length - 1] : null,
      selectedEdgeId: ids.length > 0 ? null : s.selectedEdgeId,
    })),
  addNodesToSelection: (ids) =>
    set((s) => {
      const merged = Array.from(new Set([...s.selectedNodeIds, ...ids]))
      return {
        selectedNodeIds: merged,
        selectedNodeId: merged.length > 0 ? merged[merged.length - 1] : null,
        selectedEdgeId: merged.length > 0 ? null : s.selectedEdgeId,
      }
    }),
  selectEdge: (id) =>
    set((s) => ({
      selectedEdgeId: id,
      selectedNodeId: id ? null : s.selectedNodeId,
      selectedNodeIds: id ? [] : s.selectedNodeIds,
    })),
  setActiveStage: (id) => set({ activeStageId: id }),

  // Collapse/expand is a view preference: it must survive save/reload (see PersistedShape /
  // saveDraft / init above), but deliberately does NOT call pushHistory, so it never shows up
  // in undo/redo — toggling it is not a "change" to the tree's data.
  toggleNodeCollapsed: (nodeId) =>
    set((s) => ({
      collapsedNodeIds: s.collapsedNodeIds.includes(nodeId)
        ? s.collapsedNodeIds.filter((id) => id !== nodeId)
        : [...s.collapsedNodeIds, nodeId],
    })),

  openDetail: (nodeId, screenPos) =>
    set({
      isDetailOpen: true,
      selectedNodeId: nodeId,
      selectedNodeIds: [nodeId],
      detailPosition: screenPos ? { screenX: screenPos.x, screenY: screenPos.y } : null,
    }),
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
      isDetailOpen: state.selectedNodeId === treeNodeId ? false : state.isDetailOpen,
      hasUnsavedChanges: true,
    })
  },

  removeSelectedNodes: () => {
    const state = get()
    const ids = state.selectedNodeIds.length > 0 ? state.selectedNodeIds : state.selectedNodeId ? [state.selectedNodeId] : []
    if (ids.length === 0) {
      get().showToast('Pilih node terlebih dahulu')
      return
    }
    pushHistory(get, set)
    const idSet = new Set(ids)
    set({
      treeNodes: state.treeNodes.filter((n) => !idSet.has(n.id)),
      edges: state.edges.filter((e) => !idSet.has(e.source) && !idSet.has(e.target)),
      selectedNodeId: null,
      selectedNodeIds: [],
      isDetailOpen: state.selectedNodeId && idSet.has(state.selectedNodeId) ? false : state.isDetailOpen,
      hasUnsavedChanges: true,
    })
    get().showToast(ids.length > 1 ? `${ids.length} node dihapus` : 'Node dihapus')
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

  /** Called when a multi-node drag ends: every node snaps to its own nearest stage column, but
   *  the whole move counts as a single undo step (one pushHistory call), not one per node. */
  dropTreeNodes: (moves) => {
    const state = get()
    const sortedStages = [...state.stages].sort((a, b) => a.order - b.order)
    if (sortedStages.length === 0 || moves.length === 0) return

    const moveMap = new Map(moves.map((m) => [m.treeNodeId, m.position]))

    pushHistory(get, set)
    set({
      treeNodes: state.treeNodes.map((n) => {
        const pos = moveMap.get(n.id)
        if (!pos) return n
        const nodeCenterX = pos.x + NODE_CARD_WIDTH / 2
        const order = nearestStageOrder(nodeCenterX, sortedStages.length)
        const stage = sortedStages[order]
        return { ...n, stageId: stage.id, position: { x: nodeXForStage(stage.order), y: pos.y } }
      }),
      hasUnsavedChanges: true,
    })
    get().showToast(`${moves.length} node dipindahkan`)
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

  beginConnectFrom: (treeNodeId) => set({ mode: 'connect', connectSourceId: treeNodeId }),
  cancelConnect: () => set({ connectSourceId: null, mode: 'select' }),

  // Connections are made immediately, with no confirmation step — see requestConnection below.
  requestConnection: (sourceId, targetId) => {
    if (sourceId === targetId) {
      get().showToast('Tidak bisa menghubungkan node ke dirinya sendiri')
      set({ connectSourceId: null, mode: 'select' })
      return
    }
    const alreadyConnected = get().edges.some(
      (e) => e.source === sourceId && e.target === targetId,
    )
    if (alreadyConnected) {
      get().showToast('Relasi antara kedua node ini sudah ada')
      set({ connectSourceId: null, mode: 'select' })
      return
    }
    pushHistory(get, set)
    const newEdge: IndustrialEdge = {
      id: makeId('edge'),
      source: sourceId,
      target: targetId,
      relationType: DEFAULT_RELATION_TYPE,
    }
    set((s) => ({
      edges: [...s.edges, newEdge],
      connectSourceId: null,
      mode: 'select',
      hasUnsavedChanges: true,
    }))
    get().showToast('Relasi dibuat')
  },

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
      savedAt,
      collapsedNodeIds: state.collapsedNodeIds,
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
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
      past: [],
      future: [],
      hasUnsavedChanges: false,
      collapsedNodeIds: persisted.collapsedNodeIds ?? [],
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
