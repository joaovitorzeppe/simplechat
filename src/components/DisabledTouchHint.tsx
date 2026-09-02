import type { ReactNode } from "react";
import { cn } from "@libs/cn";
import { showPlainToast } from "@libs/toast";

type Props = {
  hint: string;
  children: ReactNode;
  className?: string;
  tooltipClassName?: string;
};

const defaultTooltip =
  "pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-1/2 z-30 w-max max-w-[min(18rem,90vw)] -translate-x-1/2 rounded-lg border border-line bg-zinc-900 px-3 py-2 text-center text-xs font-medium text-zinc-200 opacity-0 shadow-xl touch-hint";

export const DisabledTouchHint = ({
  hint,
  children,
  className,
  tooltipClassName,
}: Props) => {
  return (
    <span
      className={cn(
        "touch-hint-group relative inline-flex cursor-not-allowed",
        className,
      )}
      onClick={() => {
        if (window.matchMedia("(pointer: coarse)").matches) {
          showPlainToast(hint);
        }
      }}
    >
      {children}
      <span role="tooltip" className={cn(defaultTooltip, tooltipClassName)}>
        {hint}
      </span>
    </span>
  );
};
