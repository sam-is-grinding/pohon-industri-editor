import type { NodeStatus } from '../types'

export function statusColor(status: NodeStatus): string {
  switch (status) {
    case 'produced':
      return 'var(--signal-produced)'
    case 'emerging':
      return 'var(--signal-emerging)'
    case 'critical':
      return 'var(--signal-critical)'
    case 'import_gap':
      return 'var(--signal-import-gap)'
    default:
      return 'var(--ink-500)'
  }
}

export function statusDotClass(status: NodeStatus): string {
  switch (status) {
    case 'produced':
      return 'bg-[var(--signal-produced)]'
    case 'emerging':
      return 'bg-[var(--signal-emerging)]'
    case 'critical':
      return 'bg-[var(--signal-critical)]'
    case 'import_gap':
      return 'bg-[var(--signal-import-gap)]'
    default:
      return 'bg-[var(--ink-500)]'
  }
}
