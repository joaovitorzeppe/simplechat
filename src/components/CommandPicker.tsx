import { cn } from "@libs/cn";

export type CommandPickerItem = {
  id: string;
  slash: string;
  hint: string;
  example: string;
};

type Props = {
  id: string;
  items: CommandPickerItem[];
  active: number;
  label: string;
  onPick: (item: CommandPickerItem) => void;
  onActive: (index: number) => void;
};

export const CommandPicker = ({
  id,
  items,
  active,
  label,
  onPick,
  onActive,
}: Props) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-x-0 bottom-full z-20 mb-2 overflow-hidden rounded-2xl border border-line bg-zinc-900">
      <p className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <ul id={id} role="listbox" aria-label={label} className="max-h-56 overflow-y-auto py-1">
        {items.map((item, index) => {
          const selected = index === active;
          return (
            <li key={item.id}>
              <button
                id={`${id}-${index}`}
                type="button"
                role="option"
                aria-selected={selected}
                className={cn(
                  "flex w-full flex-col gap-0.5 px-3 py-2 text-left",
                  selected ? "bg-accent/15 text-zinc-50" : "text-zinc-200",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => onActive(index)}
                onClick={() => onPick(item)}
              >
                <span className="font-mono text-sm font-medium">{item.slash}</span>
                <span className="text-xs text-zinc-400">{item.hint}</span>
                <span className="font-mono text-[11px] text-zinc-500">
                  {item.example}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
