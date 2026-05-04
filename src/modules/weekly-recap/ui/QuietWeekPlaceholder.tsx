import { Card } from "@/lib/ui";

export function QuietWeekPlaceholder() {
  return (
    <Card>
      <p className="font-mono text-mono-sm uppercase text-ambient-muted">Weekly recap</p>
      <h1 className="mt-3 text-h1 text-ambient-fg">A quiet week.</h1>
      <p className="mt-2 text-body text-ambient-muted">Once listening history has at least ten plays for the week, Daily Spin will write the Sunday journal here.</p>
    </Card>
  );
}
