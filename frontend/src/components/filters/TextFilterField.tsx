import { Input } from '../ui/Input';

interface TextFilterFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Generic, reusable free-text filter field (FR-015, FR-016), rendered at a
 * compact fixed width so lower-priority filters (Genre, Style) take up less
 * horizontal space than before, leaving more room for Format (FR-008, FR-009).
 */
export function TextFilterField({ id, label, value, onChange }: TextFilterFieldProps) {
  return (
    <div className="w-28">
      <Input
        id={id}
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
