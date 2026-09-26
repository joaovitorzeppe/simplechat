import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@libs/cn";
import { showPlainToast } from "@libs/toast";

type Props = {
  label: string;
  children: ReactNode;
  className?: string;
  /** Em tela touch, o clique mostra o texto (botões desabilitados). */
  touchToast?: boolean;
};

type Place = {
  top: number;
  left: number;
  arrow: number;
  side: "top" | "bottom";
};

const SHOW_MS = 280;
const GAP = 10;

export const Tooltip = ({ label, children, className, touchToast }: Props) => {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const timer = useRef(0);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);

  const hide = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
    setPlace(null);
  };

  const show = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), SHOW_MS);
  };

  useEffect(() => {
    return () => window.clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const close = () => {
      window.clearTimeout(timer.current);
      setOpen(false);
      setPlace(null);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const trigger = triggerRef.current?.getBoundingClientRect();
    const tip = tipRef.current?.getBoundingClientRect();
    if (!trigger || !tip || tip.width === 0) {
      return;
    }
    const side: "top" | "bottom" =
      trigger.top >= tip.height + GAP + 8 ? "top" : "bottom";
    const top =
      side === "top" ? trigger.top - tip.height - GAP : trigger.bottom + GAP;
    const left = Math.min(
      Math.max(8, trigger.left + trigger.width / 2 - tip.width / 2),
      window.innerWidth - tip.width - 8,
    );
    const arrow = trigger.left + trigger.width / 2 - left;
    setPlace({ top, left, arrow, side });
  }, [open]);

  return (
    <span
      ref={triggerRef}
      className={cn(
        "relative inline-flex",
        touchToast && "cursor-not-allowed",
        className,
      )}
      onPointerEnter={(event) => {
        if (event.pointerType === "touch") {
          return;
        }
        show();
      }}
      onPointerLeave={hide}
      onFocus={() => {
        window.clearTimeout(timer.current);
        setOpen(true);
      }}
      onBlur={hide}
      onClick={() => {
        if (!touchToast) {
          return;
        }
        if (window.matchMedia("(pointer: coarse)").matches) {
          showPlainToast(label);
        }
      }}
    >
      {children}
      {open &&
        createPortal(
          <span
            ref={tipRef}
            role="tooltip"
            style={{
              top: place?.top ?? -9999,
              left: place?.left ?? 0,
            }}
            className={cn(
              "pointer-events-none fixed z-50 w-max max-w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-center text-xs font-medium text-zinc-50 shadow-[0_0_0_1px_rgba(45,212,191,0.14),0_10px_28px_rgba(0,0,0,0.55)]",
              place ? "opacity-100" : "opacity-0",
            )}
          >
            {label}
            <span
              aria-hidden
              style={{ left: place?.arrow }}
              className={cn(
                "absolute size-2 -translate-x-1/2 rotate-45 bg-zinc-900",
                place?.side === "bottom"
                  ? "top-0 -translate-y-1/2 border-t border-l border-zinc-700"
                  : "bottom-0 translate-y-1/2 border-b border-r border-zinc-700",
              )}
            />
          </span>,
          document.body,
        )}
    </span>
  );
};
