import type { MentionPerson } from "@libs/mentions";
import { displayLabel } from "@libs/text";
import { cn } from "@libs/cn";

type Item =
  | { kind: "all"; label: string }
  | { kind: "peer"; person: MentionPerson };

type Props = {
  items: Item[];
  people: MentionPerson[];
  active: number;
  label: string;
  allLabel: string;
  onPick: (item: Item) => void;
  onActive: (index: number) => void;
};

export const MentionPicker = ({
  items,
  people,
  active,
  label,
  allLabel,
  onPick,
  onActive,
}: Props) => {
  if (items.length === 0) return null;

  return (
    <ul
      role="listbox"
      aria-label={label}
      className="absolute inset-x-0 bottom-full z-20 mb-2 max-h-48 overflow-y-auto rounded-2xl border border-line bg-zinc-900 py-1"
    >
      {items.map((item, index) => {
        const selected = index === active;
        const name =
          item.kind === "all"
            ? `@all`
            : `@${displayLabel(item.person.displayName, item.person.peerId, people)}`;
        const hint = item.kind === "all" ? allLabel : null;
        return (
          <li key={item.kind === "all" ? "all" : item.person.peerId}>
            <button
              type="button"
              role="option"
              aria-selected={selected}
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm",
                selected ? "bg-accent/15 text-zinc-50" : "text-zinc-200",
              )}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => onActive(index)}
              onClick={() => onPick(item)}
            >
              <span className="min-w-0 truncate font-medium">{name}</span>
              {hint && (
                <span className="shrink-0 text-[11px] text-zinc-500">
                  {hint}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
};
