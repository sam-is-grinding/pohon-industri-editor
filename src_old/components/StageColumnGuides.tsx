import { useTreeStore } from '../store/useTreeStore'
import { STAGE_COLUMN_WIDTH } from '../utils/layout'

interface Props {
  translateX: number
  translateY: number
  zoom: number
}

export function StageColumnGuides({ translateX, translateY, zoom }: Props) {
  const stageCount = useTreeStore((s) => s.stages.length)

  const lines = Array.from({ length: stageCount + 1 }, (_, i) => i)

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute top-0 h-[6000px]"
        style={{
          transform: `translate(${translateX}px, ${translateY}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {lines.map((i) => (
          <div
            key={i}
            className="absolute top-0 h-full w-px border-l border-dashed border-[var(--ink-300)]"
            style={{ left: i * STAGE_COLUMN_WIDTH }}
          />
        ))}
      </div>
    </div>
  )
}
