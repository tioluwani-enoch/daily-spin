import { clsx } from "clsx";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "min-h-11 w-full rounded-md border border-ambient-edge bg-white/35 px-3 text-body text-ambient-fg outline-none transition placeholder:text-ambient-muted focus:border-ambient-accent",
        className
      )}
      {...props}
    />
  );
}
