import { clsx } from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "ghost" | "accent" | "quiet";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

export function Button({ className, variant = "ghost", children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 py-2 text-meta transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ambient-accent disabled:cursor-not-allowed disabled:opacity-50",
        variant === "accent" && "bg-ambient-accent text-white hover:bg-ambient-accent-soft",
        variant === "ghost" && "border border-ambient-edge bg-ambient-surface text-ambient-fg hover:border-ambient-accent",
        variant === "quiet" && "text-ambient-muted hover:text-ambient-fg",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
