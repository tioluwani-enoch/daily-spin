import { clsx } from "clsx";
import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return (
    <section className={clsx("rounded-lg border border-ambient-edge bg-ambient-surface p-4 shadow-ambient backdrop-blur sm:p-6", className)}>
      {children}
    </section>
  );
}
