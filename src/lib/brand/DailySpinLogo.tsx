import Link from "next/link";

export function DailySpinLogo() {
  return (
    <Link className="group inline-flex items-center gap-3 text-ambient-fg" href="/" aria-label="Daily Spin home">
      <span className="relative grid h-10 w-10 shrink-0 place-items-center">
        <span className="absolute inset-0 rounded-full border border-ambient-edge bg-ambient-surface shadow-ambient transition group-hover:border-ambient-accent" />
        <span className="absolute h-7 w-7 rounded-full border border-ambient-fg/70" />
        <span className="absolute h-3 w-3 rounded-full border border-ambient-accent bg-ambient-bg" />
        <span className="absolute left-1/2 top-[0.45rem] h-[0.42rem] w-[1.15rem] -translate-x-1/2 rounded-t-full border border-b-0 border-ambient-accent" />
        <span className="absolute right-[0.56rem] top-[0.8rem] h-1.5 w-1.5 rounded-full bg-ambient-accent" />
      </span>
      <span className="grid leading-none">
        <span className="text-h2 text-ambient-fg">Daily Spin</span>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ambient-muted">love it again</span>
      </span>
    </Link>
  );
}
