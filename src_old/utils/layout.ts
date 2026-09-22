export const STAGE_COLUMN_WIDTH = 300
export const STAGE_COLUMN_PADDING = 40
export const NODE_CARD_WIDTH = 220
export const NODE_CARD_MIN_HEIGHT = 92
export const NODE_ROW_HEIGHT = 150

/** X position (canvas coords) of the left edge of a stage column, by stage order. */
export function stageColumnX(order: number): number {
  return order * STAGE_COLUMN_WIDTH
}

/** X position for a node card centered within its stage column. */
export function nodeXForStage(order: number): number {
  return stageColumnX(order) + (STAGE_COLUMN_WIDTH - NODE_CARD_WIDTH) / 2
}

/** Default Y for the nth node added to a stage (simple vertical stacking). */
export function defaultNodeY(indexInStage: number): number {
  return 40 + indexInStage * NODE_ROW_HEIGHT
}

export function stageCode(order: number): string {
  return `S${order}`
}
