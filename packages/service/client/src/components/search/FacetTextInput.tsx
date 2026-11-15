import { X } from 'lucide-react';

/** A free-text (text or number) facet: one input. */
export function FacetTextInput({
  label,
  value,
  onChange,
  inputType = 'text',
  onRemove,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputType?: 'text' | 'number';
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground font-medium">
        {label}:
      </span>
      <input
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Filter by ${label.toLowerCase()}...`}
        className="text-xs px-2 py-0.5 rounded border border-border bg-muted text-foreground placeholder:text-muted-foreground w-64 outline-none focus:border-primary"
      />
      <button
        onClick={onRemove}
        className="text-muted-foreground hover:text-foreground"
        title={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
