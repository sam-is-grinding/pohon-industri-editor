// ============================================================
// CORE DOMAIN TYPES — Pohon Industri Editor
// ============================================================

export type NodeType =
  | 'raw_material'
  | 'intermediate'
  | 'finished_product'
  | 'application'

export type Priority = 'P1' | 'P2' | 'P3' | 'P4'

export type NodeStatus = 'produced' | 'emerging' | 'critical' | 'import_gap'

export type RelationType = 'transformation' | 'input' | 'output' | 'application'

export interface PatentData {
  universityDomestic: number
  brin: number
  domesticIndustry: number
  foreign: number
  other: number
}

/**
 * MASTER NODE CATALOG
 * Hardcoded, READ-ONLY reference data. Never mutated by the editor.
 */
export interface MasterNode {
  id: string
  name: string
  hsCode: string
  nodeType: NodeType
  priority: Priority
  status: NodeStatus
  score: number
  exportValue: number
  importValue: number
  valueAdded: boolean
  patents: PatentData
  applications: string[]
}

/**
 * A stage is a horizontal production layer (S0..S10), fully configurable.
 */
export interface Stage {
  id: string
  code: string // auto-derived, e.g. "S0", "S1"...
  name: string
  order: number
}

/**
 * Per-tree editable state for a node placed on the canvas.
 * References a MasterNode by id — never duplicates or edits master fields.
 */
export interface TreeNodeEditorState {
  priority: Priority
  status: NodeStatus
}

export interface TreeNode {
  id: string
  masterNodeId: string
  stageId: string
  position: { x: number; y: number }
  editorState: TreeNodeEditorState
}

export interface IndustrialEdge {
  id: string
  source: string // TreeNode id
  target: string // TreeNode id
  relationType: RelationType
}

export type PublishStatus = 'draft' | 'published'

export type EditorMode = 'select' | 'connect' | 'pan' | 'delete-relation'

export interface ValidationIssue {
  id: string
  level: 'error' | 'warning'
  message: string
  detail?: string
  relatedNodeIds?: string[]
  relatedEdgeIds?: string[]
}

export interface TreeSnapshot {
  stages: Stage[]
  treeNodes: TreeNode[]
  edges: IndustrialEdge[]
}

export const NODE_TYPE_LABEL: Record<NodeType, string> = {
  raw_material: 'Raw Material',
  intermediate: 'Intermediate',
  finished_product: 'Finished Product',
  application: 'Application',
}

export const STATUS_LABEL: Record<NodeStatus, string> = {
  produced: 'PRODUCED',
  emerging: 'EMERGING',
  critical: 'CRITICAL',
  import_gap: 'IMPORT GAP',
}

export const RELATION_LABEL: Record<RelationType, string> = {
  transformation: 'Transformation',
  input: 'Input',
  output: 'Output',
  application: 'Application',
}
