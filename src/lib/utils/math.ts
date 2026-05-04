export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function cosineDistance(a: number[], b: number[]): number {
  const dot = a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 1;
  }

  return clamp01(1 - dot / (magnitudeA * magnitudeB));
}

export function weightedChoice<T>(
  items: T[],
  getWeight: (item: T) => number,
  random = Math.random
): T | null {
  const total = items.reduce((sum, item) => sum + Math.max(0, getWeight(item)), 0);
  if (items.length === 0 || total === 0) {
    return items[0] ?? null;
  }

  let cursor = random() * total;
  for (const item of items) {
    cursor -= Math.max(0, getWeight(item));
    if (cursor <= 0) {
      return item;
    }
  }

  return items.at(-1) ?? null;
}
