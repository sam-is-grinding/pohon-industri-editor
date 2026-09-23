export const STAGE_COLUMN_WIDTH = 300
export const STAGE_COLUMN_PADDING = 40
export const NODE_CARD_WIDTH = 220
// Fixed card height: content is single-line/truncated everywhere, so the rendered card is
// always this tall. Declaring it (rather than leaving it to auto/measured height) keeps
// React Flow's minimap accurate from the very first paint instead of showing a placeholder dot.
export const NODE_CARD_HEIGHT = 98
export const NODE_CARD_MIN_HEIGHT = NODE_CARD_HEIGHT
export const NODE_ROW_HEIGHT = 150

/**
 * On-screen size (px) we want connection handles' hit-area and dashed ring to occupy,
 * regardless of canvas zoom level. Used both for the CSS inverse-zoom scale
 * (--handle-zoom-scale) and for React Flow's `connectionRadius`, via the same formula:
 * value-in-flow-units * zoom * (1 / zoom) === value-in-flow-units, i.e. always this constant
 * on screen. Keeping one shared constant keeps the visual size and the "kena/tidak kena"
 * snapping tolerance consistent with each other at every zoom level.
 */
export const HANDLE_HIT_AREA_PX = 24

/** Inverse-zoom scale factor to counter the canvas viewport's own zoom transform. */
export function handleZoomScale(zoom: number): number {
  if (!zoom || Number.isNaN(zoom)) return 1
  return 1 / zoom
}

/** Flow-space connection radius that resolves to a constant on-screen tolerance at any zoom. */
export function connectionRadiusForZoom(zoom: number): number {
  if (!zoom || Number.isNaN(zoom)) return HANDLE_HIT_AREA_PX
  return HANDLE_HIT_AREA_PX / zoom
}

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
