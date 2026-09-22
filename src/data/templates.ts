import type { IndustrialEdge, Stage, TreeNode } from '../types'
import { defaultNodeY, nodeXForStage, stageCode } from '../utils/layout'

export type TemplateId = 'empty' | 'example_nickel' | 'example_iron_steel'

export interface Template {
  id: TemplateId
  label: string
  description: string
}

export const TEMPLATES: Template[] = [
  { id: 'empty', label: 'Empty', description: 'Canvas kosong, mulai dari nol.' },
  {
    id: 'example_nickel',
    label: 'Example Nickel',
    description: 'Contoh pohon rantai nikel: tambang → smelter → produk antara.',
  },
  {
    id: 'example_iron_steel',
    label: 'Example Iron-Steel',
    description: 'Contoh pohon rantai besi-baja: bijih besi → HRC/CRC → aplikasi.',
  },
]

function defaultStages(): Stage[] {
  const names = ['Tambang', 'Konsentrat', 'Peleburan', 'Paduan', 'Antara']
  return names.map((name, order) => ({
    id: `stage-${stageCode(order)}`,
    code: stageCode(order),
    name,
    order,
  }))
}

export interface TemplateResult {
  stages: Stage[]
  treeNodes: TreeNode[]
  edges: IndustrialEdge[]
}

export function buildTemplate(id: TemplateId): TemplateResult {
  if (id === 'empty') {
    return { stages: defaultStages(), treeNodes: [], edges: [] }
  }

  if (id === 'example_nickel') {
    const stages = defaultStages()
    const byOrder = (o: number) => stages.find((s) => s.order === o)!.id

    const treeNodes: TreeNode[] = [
      tn('tn-1', 'nickel-saprolite', byOrder(0), 0, 0),
      tn('tn-2', 'limonite', byOrder(0), 0, 2),
      tn('tn-3', 'nickel-pig-iron', byOrder(2), 2, 1),
      tn('tn-4', 'ferronickel', byOrder(3), 3, 0),
      tn('tn-5', 'nickel-matte', byOrder(4), 4, 1),
      tn('tn-6', 'mhp', byOrder(4), 4, 3),
    ]

    const edges: IndustrialEdge[] = [
      edge('e-1', 'tn-1', 'tn-3', 'transformation'),
      edge('e-2', 'tn-3', 'tn-4', 'transformation'),
      edge('e-3', 'tn-3', 'tn-5', 'output'),
      edge('e-4', 'tn-5', 'tn-6', 'transformation'),
      edge('e-5', 'tn-2', 'tn-6', 'input'),
    ]

    return { stages, treeNodes, edges }
  }

  // example_iron_steel
  const stages = defaultStages()
  stages.push({ id: 'stage-S5', code: 'S5', name: 'Aplikasi', order: 5 })
  const byOrder = (o: number) => stages.find((s) => s.order === o)!.id

  const treeNodes: TreeNode[] = [
    tn('tn-i1', 'iron-ore', byOrder(0), 0, 0),
    tn('tn-i2', 'pig-iron', byOrder(2), 2, 0),
    tn('tn-i3', 'crude-steel', byOrder(3), 3, 0),
    tn('tn-i4', 'hot-rolled-coil', byOrder(4), 4, 0),
    tn('tn-i5', 'cold-rolled-coil', byOrder(4), 4, 2),
    tn('tn-i6', 'automotive-panel', byOrder(5), 5, 1),
  ]

  const edges: IndustrialEdge[] = [
    edge('e-i1', 'tn-i1', 'tn-i2', 'transformation'),
    edge('e-i2', 'tn-i2', 'tn-i3', 'transformation'),
    edge('e-i3', 'tn-i3', 'tn-i4', 'transformation'),
    edge('e-i4', 'tn-i4', 'tn-i5', 'transformation'),
    edge('e-i5', 'tn-i5', 'tn-i6', 'application'),
  ]

  return { stages, treeNodes, edges }
}

function tn(
  id: string,
  masterNodeId: string,
  stageId: string,
  stageOrder: number,
  rowIndex: number,
): TreeNode {
  return {
    id,
    masterNodeId,
    stageId,
    position: { x: nodeXForStage(stageOrder), y: defaultNodeY(rowIndex) },
    editorState: { priority: masterPriorityFallback(), status: 'produced' },
  }
}

// Editor state is seeded from a sensible default and immediately overridden
// by the real master priority/status when the tree is created (see store).
function masterPriorityFallback(): 'P1' | 'P2' | 'P3' | 'P4' {
  return 'P3'
}

function edge(
  id: string,
  source: string,
  target: string,
  relationType: IndustrialEdge['relationType'],
): IndustrialEdge {
  return { id, source, target, relationType }
}
