import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { UploadRecord } from '@/hooks/useDeals';

interface Props {
  uploads: UploadRecord[];
  selected: string | null;
  onSelect: (id: string) => void;
  label: string;
}

export function WeekSelector({ uploads, selected, onSelect, label }: Props) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      <Select value={selected || ''} onValueChange={onSelect}>
        <SelectTrigger className="w-48 bg-secondary/50">
          <SelectValue placeholder="Select week" />
        </SelectTrigger>
        <SelectContent>
          {uploads.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.week_label} ({u.record_count} deals)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
