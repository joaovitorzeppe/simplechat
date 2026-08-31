import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "icon";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const styles: Record<Variant, string> = {
  primary:
    "bg-accent text-ink hover:bg-teal-300 disabled:bg-zinc-700 disabled:text-zinc-400",
  secondary: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-line",
  danger: "bg-red-500 text-white hover:bg-red-400",
  ghost: "bg-transparent text-zinc-300 hover:bg-zinc-800",
  icon: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-line size-11 p-0 rounded-full",
};

export const Button = ({
  variant = "primary",
  className,
  type = "button",
  ...props
}: Props) => {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition cursor-pointer disabled:cursor-not-allowed",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}
