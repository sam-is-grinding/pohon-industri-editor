export const STAGE_COLUMN_WIDTH = 300
export const STAGE_COLUMN_PADDING = 40
export const NODE_CARD_WIDTH = 220
// Fixed card height: content is single-line/truncated everywhere, so the rendered card is
// always this tall. Declaring it (rather than leaving it to auto/measured height) keeps
// React Flow's minimap accurate from the very first paint instead of showing a placeholder dot.
export const NODE_CARD_HEIGHT = 98
export const NODE_CARD_MIN_HEIGHT = NODE_CARD_HEIGHT
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

/** Given a free-form canvas x position, find which stage column order it's nearest to. */
export function nearestStageOrder(x: number, stageCount: number): number {
  if (stageCount <= 0) return 0
  const order = Math.round(x / STAGE_COLUMN_WIDTH - 0.5)
  return Math.min(Math.max(order, 0), stageCount - 1)
}
