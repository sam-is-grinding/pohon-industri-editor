import { useTreeStore } from '../store/useTreeStore'
import { STAGE_COLUMN_WIDTH } from '../utils/layout'

interface Props {
  translateX: number
  zoom: number
}

export function StageColumnGuides({ translateX, zoom }: Props) {
  const stageCount = useTreeStore((s) => s.stages.length)

  const lines = Array.from({ length: stageCount + 1 }, (_, i) => i)

  // The canvas pans infinitely, so these dashed separators must too. Rather than translating a
  // finite-height strip vertically (which used to run out once you panned far enough and the
  // guides would simply vanish), each line is just pinned to the full height of the viewport —
  // only its horizontal position depends on pan/zoom. That makes it track panning forever with
  // no bound in either direction.
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {lines.map((i) => (
        <div
          key={i}
          className="absolute top-0 h-full w-px border-l border-dashed border-[var(--ink-300)] opacity-70"
          style={{ left: i * STAGE_COLUMN_WIDTH * zoom + translateX }}
        />
      ))}
    </div>
  )
}
