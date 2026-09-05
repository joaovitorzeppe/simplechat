import type { ButtonHTMLAttributes } from "react";
import { Tooltip } from "./Tooltip";
import { cn } from "@libs/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "icon";
type Size = "md" | "sm" | "none";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** Padding. Ignorado em `icon` (já traz size/p-0). */
  size?: Size;
};

const styles: Record<Variant, string> = {
  primary:
    "bg-accent text-on-accent hover:bg-teal-300 disabled:bg-zinc-700 disabled:text-zinc-400",
  secondary:
    "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-line disabled:bg-zinc-800 disabled:text-zinc-500",
  danger: "bg-red-500 text-white hover:bg-red-400",
  ghost: "bg-transparent text-zinc-300 hover:bg-zinc-800",
  icon: "size-12 shrink-0 rounded-full border border-line bg-zinc-800 p-0 text-zinc-100 hover:bg-zinc-700",
};

const sizes: Record<Size, string> = {
  md: "px-4 py-2.5",
  sm: "px-2.5 py-1",
  none: "",
};

export const Button = ({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  disabled,
  title,
  ...props
}: Props) => {
  const button = (
    <button
      type={type}
      disabled={disabled}
      // Vários botões são só ícone: sem isto o leitor de tela anuncia "botão".
      aria-label={props["aria-label"] ?? title}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition cursor-pointer disabled:cursor-not-allowed disabled:pointer-events-none",
        styles[variant],
        variant === "icon" ? null : sizes[size],
        className,
      )}
      {...props}
    />
  );

  if (!title) return button;

  return (
    <Tooltip
      label={title}
      touchToast={!!disabled}
      className={/\bw-full\b/.test(className ?? "") ? "w-full" : undefined}
    >
      {button}
    </Tooltip>
  );
};
