import type { ButtonHTMLAttributes } from "react";
import { Tooltip } from "./Tooltip";
import { cn } from "@libs/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "icon";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const styles: Record<Variant, string> = {
  primary:
    "bg-accent text-ink hover:bg-teal-300 disabled:bg-zinc-700 disabled:text-zinc-400",
  secondary:
    "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-line disabled:bg-zinc-800 disabled:text-zinc-500",
  danger: "bg-red-500 text-white hover:bg-red-400",
  ghost: "bg-transparent text-zinc-300 hover:bg-zinc-800",
  icon: "size-12 shrink-0 rounded-full border border-line bg-zinc-800 p-0 text-zinc-100 hover:bg-zinc-700",
};

export const Button = ({
  variant = "primary",
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
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition cursor-pointer disabled:cursor-not-allowed disabled:pointer-events-none",
        styles[variant],
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
