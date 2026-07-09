import { useState } from "react";
import { ChevronDown, ChevronRight, Briefcase, MapPin, Factory, Users, DollarSign, Gauge, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

export interface LeadFilterValues {
  jobTitles: string[];
  locations: string[];
  industries: string[];
  companySizeMin: string;
  companySizeMax: string;
  revenueMin: string;
  revenueMax: string;
  fitScoreMin: number;
  region: string;
}

interface FilterSectionProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function FilterSection({ icon, label, children, defaultOpen = false }: FilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/40">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 w-full py-3.5 px-4 text-sm font-medium text-foreground hover:bg-accent/50 transition-colors"
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-3.5 space-y-2">{children}</div>}
    </div>
  );
}

function TagInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setInput("");
  };
  return (
    <div className="space-y-2">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-xs bg-background"
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
      />
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="text-xs cursor-pointer hover:bg-destructive/20 hover:text-destructive transition-colors" onClick={() => onChange(values.filter((x) => x !== v))}>
              {v} ×
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

interface LeadFiltersProps {
  filters: LeadFilterValues;
  onChange: (filters: LeadFilterValues) => void;
}

export function LeadFilters({ filters, onChange }: LeadFiltersProps) {
  const update = (partial: Partial<LeadFilterValues>) => onChange({ ...filters, ...partial });

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3.5 border-b border-border/40">
        <h3 className="text-sm font-semibold text-foreground">Filters</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        <FilterSection icon={<Gauge className="h-4 w-4" />} label="Fit Score" defaultOpen>
          <div className="space-y-2">
            <Slider
              value={[filters.fitScoreMin]}
              onValueChange={([v]) => update({ fitScoreMin: v })}
              min={0}
              max={10}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">Min score: {filters.fitScoreMin || "Any"}</p>
          </div>
        </FilterSection>

        <FilterSection icon={<Globe className="h-4 w-4" />} label="Region" defaultOpen>
          <Select value={filters.region} onValueChange={(v) => update({ region: v })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              <SelectItem value="US">US</SelectItem>
              <SelectItem value="EU">EU</SelectItem>
              <SelectItem value="UK">UK</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </FilterSection>

        <FilterSection icon={<Briefcase className="h-4 w-4" />} label="Job Titles">
          <TagInput values={filters.jobTitles} onChange={(v) => update({ jobTitles: v })} placeholder="e.g. VP Sales, CTO…" />
        </FilterSection>

        <FilterSection icon={<MapPin className="h-4 w-4" />} label="Location">
          <TagInput values={filters.locations} onChange={(v) => update({ locations: v })} placeholder="e.g. New York, London…" />
        </FilterSection>

        <FilterSection icon={<Factory className="h-4 w-4" />} label="Industry & Keywords">
          <TagInput values={filters.industries} onChange={(v) => update({ industries: v })} placeholder="e.g. SaaS, Fintech…" />
        </FilterSection>

        <FilterSection icon={<Users className="h-4 w-4" />} label="Company Size">
          <div className="flex gap-2 items-center">
            <Input value={filters.companySizeMin} onChange={(e) => update({ companySizeMin: e.target.value })} placeholder="Min" className="h-8 text-xs bg-background" />
            <span className="text-xs text-muted-foreground">–</span>
            <Input value={filters.companySizeMax} onChange={(e) => update({ companySizeMax: e.target.value })} placeholder="Max" className="h-8 text-xs bg-background" />
          </div>
        </FilterSection>

        <FilterSection icon={<DollarSign className="h-4 w-4" />} label="Revenue">
          <div className="flex gap-2 items-center">
            <Input value={filters.revenueMin} onChange={(e) => update({ revenueMin: e.target.value })} placeholder="Min" className="h-8 text-xs bg-background" />
            <span className="text-xs text-muted-foreground">–</span>
            <Input value={filters.revenueMax} onChange={(e) => update({ revenueMax: e.target.value })} placeholder="Max" className="h-8 text-xs bg-background" />
          </div>
        </FilterSection>
      </div>
    </div>
  );
}

export const emptyFilters: LeadFilterValues = {
  jobTitles: [],
  locations: [],
  industries: [],
  companySizeMin: "",
  companySizeMax: "",
  revenueMin: "",
  revenueMax: "",
  
  fitScoreMin: 0,
  region: "all",
};
