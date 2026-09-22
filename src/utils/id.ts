let counter = 0

/** Small, dependency-free unique id generator (good enough for a local prototype). */
export function makeId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`
}
