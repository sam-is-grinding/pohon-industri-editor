import { BaseEdge, getSmoothStepPath, Position, useStore, type EdgeProps } from '@xyflow/react'
import { handleZoomScale } from '../../utils/layout'

export interface ElbowEdgeData extends Record<string, unknown> {
  /** Jarak (px) garis vertikal "batang" dari sisi node sumber. Tiap sumber dapat lane sendiri. */
  trunkOffset?: number
}

// Ukuran kotak handle di CSS (index.css: width/height 30px * --handle-zoom-scale)
const HANDLE_BOX_PX = 30

export function ElbowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  selected,
  data,
}: EdgeProps) {
  const zoom = useStore((s) => s.transform[2])

  // React Flow mengakhiri edge di tepi luar kotak handle. Geser setengah lebar handle
  // supaya garis/panah berhenti tepat di titik tengah handle (dot), bukan di lingkaran.
  const half = (HANDLE_BOX_PX / 2) * handleZoomScale(zoom)
  const sx = sourcePosition === Position.Right ? sourceX - half : sourceX
  const tx = targetPosition === Position.Left ? targetX + half : targetX

  const offset = (data as ElbowEdgeData | undefined)?.trunkOffset
  const forward = tx - sx > 0
  const centerX = forward && typeof offset === 'number' ? sx + offset : undefined

  const [path] = getSmoothStepPath({
    sourceX: sx,
    sourceY,
    sourcePosition,
    targetX: tx,
    targetY,
    targetPosition,
    borderRadius: 6, // ganti 0 kalau mau siku murni
    centerX,
    offset: 0, // jangan paksa garis lurus 20px dulu, belok di centerX (trunk lane)
  })

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={style}
      className={selected ? 'selected' : undefined}
    />
  )
}