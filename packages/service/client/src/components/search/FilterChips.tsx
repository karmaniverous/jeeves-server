import { X } from 'lucide-react';

/** An enumerated facet with few values: one toggle chip per value. */
export function FilterChips({
  label,
  values,
  selected,
  onToggle,
  onRemove,
}: {
  label: string;
  values: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-muted-foreground font-medium">
        {label}:
      </span>
      {values.map((v) => (
        <button
          key={v}
          onClick={() => onToggle(v)}
          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
            selected.has(v)
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-muted text-muted-foreground border-border hover:bg-accent'
          }`}
        >
          {v}
        </button>
      ))}
      <button
        onClick={onRemove}
        className="text-muted-foreground hover:text-foreground ml-0.5"
        title={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
