export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, to = new Date()): number {
  const from = new Date(fromIso);
  const diff = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

export function nowIso(): string {
  return new Date().toISOString();
}
