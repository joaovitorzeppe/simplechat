import type { ButtonHTMLAttributes } from "react";
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
  icon: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-line size-11 p-0 rounded-full",
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
      title={disabled ? undefined : title}
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

  if (!disabled || !title) return button;

  return (
    <span
      className={cn(
        "relative inline-flex group cursor-not-allowed",
        /\bw-full\b/.test(className ?? "") && "w-full",
      )}
    >
      {button}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-1/2 z-30 w-max max-w-[min(18rem,90vw)] -translate-x-1/2 rounded-lg border border-line bg-zinc-900 px-3 py-2 text-center text-xs font-medium text-zinc-200 opacity-0 shadow-xl group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {title}
      </span>
    </span>
  );
};
