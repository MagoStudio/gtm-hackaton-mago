import { useState } from "react";
import { Check, X, ExternalLink, Loader2, Plus, Sparkles, Mail, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface LeadResult {
  id: string;
  company: string;
  contact_name: string;
  job_title: string;
  email: string;
  linkedin_url: string;
  company_size: string;
  vertical: string;
  location: string;
  source: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  // Enrichment fields
  summary?: string;
  fit_score?: number;
  fit_reason?: string;
  pain_points?: string[];
  tech_stack?: string[];
  product_hooks?: string[];
  champions?: { name: string; title: string; linkedin_url?: string }[];
  recent_signals?: string[];
  research_depth?: string;
  last_enriched_at?: string;
  
  website?: string;
  region?: string;
  employee_count?: string;
  funding_stage?: string;
}

interface LeadResultsTableProps {
  leads: LeadResult[];
  onApprove: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
  onBulkAddToPipe: (ids: string[]) => void;
  onEnrich?: (id: string) => void;
  onBulkEnrich?: (ids: string[]) => void;
  onGenerateOutreach?: (id: string) => void;
  enrichingIds?: Set<string>;
  generatingOutreachId?: string;
}

function FitScoreBadge({ score }: { score: number }) {
  let color = "bg-muted text-muted-foreground";
  let label = "Cold";
  if (score >= 9) { color = "bg-red-500/15 text-red-600 dark:text-red-400"; label = "Hot"; }
  else if (score >= 6) { color = "bg-amber-500/15 text-amber-600 dark:text-amber-400"; label = "Warm"; }
  else if (score >= 3) { color = "bg-blue-500/15 text-blue-600 dark:text-blue-400"; label = "Cool"; }

  return (
    <Badge variant="secondary" className={cn("text-xs font-semibold border-0", color)}>
      {score} · {label}
    </Badge>
  );
}

function ChampionsPopover({ champions }: { champions: { name: string; title: string; linkedin_url?: string }[] }) {
  if (!champions.length) return <span className="text-muted-foreground">—</span>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-xs text-primary hover:underline">
          {champions.length} champion{champions.length > 1 ? "s" : ""}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <p className="text-xs font-semibold mb-2">Decision Makers</p>
        <div className="space-y-2">
          {champions.map((c, i) => (
            <div key={i} className="text-xs">
              <span className="font-medium">{c.name}</span>
              <span className="text-muted-foreground"> · {c.title}</span>
              {c.linkedin_url && (
                <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="ml-1 text-primary hover:underline">
                  <ExternalLink className="h-3 w-3 inline" />
                </a>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ExpandableRow({ lead, index, selected, onToggle, onApprove, onReject, onEnrich, onGenerateOutreach, isEnriching, isGeneratingOutreach }: {
  lead: LeadResult;
  index: number;
  selected: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: (reason?: string) => void;
  onEnrich?: () => void;
  onGenerateOutreach?: () => void;
  isEnriching: boolean;
  isGeneratingOutreach: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isEnriched = lead.research_depth === "enriched";

  return (
    <>
      <TableRow
        className={cn(
          "animate-in fade-in-0 slide-in-from-bottom-2 group cursor-pointer",
          lead.status === "approved" && "bg-primary/5",
          lead.status === "rejected" && "opacity-40"
        )}
        style={{ animationDelay: `${index * 40}ms`, animationFillMode: "backwards" }}
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected} onCheckedChange={onToggle} disabled={lead.status !== "pending"} />
        </TableCell>
        <TableCell className="text-xs text-muted-foreground font-medium">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </TableCell>
        <TableCell className="text-sm font-medium">{lead.company || "—"}</TableCell>
        <TableCell className="text-sm text-muted-foreground">{lead.vertical || "—"}</TableCell>
        <TableCell>
          {lead.fit_score ? <FitScoreBadge score={lead.fit_score} /> : <span className="text-xs text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground truncate max-w-[140px]">{lead.location || lead.region || "—"}</TableCell>
        <TableCell>
          {lead.champions?.length ? <ChampionsPopover champions={lead.champions} /> : <span className="text-xs text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1 justify-end">
            {!isEnriched && onEnrich && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-500 hover:bg-amber-500/10" onClick={onEnrich} disabled={isEnriching}>
                      {isEnriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Enrich lead</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {isEnriched && onGenerateOutreach && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-500 hover:bg-blue-500/10" onClick={onGenerateOutreach} disabled={isGeneratingOutreach}>
                      {isGeneratingOutreach ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Generate outreach</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {lead.status === "pending" ? (
              <>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:bg-primary/10" onClick={onApprove}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <RejectPopover onReject={onReject} />
              </>
            ) : (
              <Badge
                variant={lead.status === "approved" ? "default" : "secondary"}
                className={cn("text-xs", lead.status === "approved" && "bg-primary/15 text-primary border-0")}
              >
                {lead.status}
              </Badge>
            )}
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={8} className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                {lead.summary && (
                  <div>
                    <span className="font-semibold text-foreground">Summary:</span>
                    <p className="text-muted-foreground mt-0.5">{lead.summary}</p>
                  </div>
                )}
                {lead.fit_reason && (
                  <div>
                    <span className="font-semibold text-foreground">Fit Reason:</span>
                    <p className="text-muted-foreground mt-0.5">{lead.fit_reason}</p>
                  </div>
                )}
                {lead.website && (
                  <div>
                    <span className="font-semibold text-foreground">Website: </span>
                    <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {lead.website.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                )}
                {lead.employee_count && (
                  <div><span className="font-semibold text-foreground">Employees:</span> <span className="text-muted-foreground">{lead.employee_count}</span></div>
                )}
                {lead.funding_stage && (
                  <div><span className="font-semibold text-foreground">Funding:</span> <span className="text-muted-foreground">{lead.funding_stage}</span></div>
                )}
              </div>
              <div className="space-y-2">
                {lead.pain_points?.length ? (
                  <div>
                    <span className="font-semibold text-foreground">Pain Points:</span>
                    <div className="flex flex-wrap gap-1 mt-1">{lead.pain_points.map((p, i) => <Badge key={i} variant="secondary" className="text-xs">{p}</Badge>)}</div>
                  </div>
                ) : null}
                {lead.tech_stack?.length ? (
                  <div>
                    <span className="font-semibold text-foreground">Tech Stack:</span>
                    <div className="flex flex-wrap gap-1 mt-1">{lead.tech_stack.map((t, i) => <Badge key={i} variant="outline" className="text-xs">{t}</Badge>)}</div>
                  </div>
                ) : null}
                {lead.recent_signals?.length ? (
                  <div>
                    <span className="font-semibold text-foreground">Recent Signals:</span>
                    <ul className="text-muted-foreground mt-0.5 list-disc list-inside">{lead.recent_signals.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                ) : null}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function RejectPopover({ onReject }: { onReject: (reason?: string) => void }) {
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10">
          <X className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <p className="text-xs font-medium mb-2 text-foreground">Why reject this lead?</p>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional feedback…" className="text-xs min-h-[60px] mb-2" />
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => { onReject(reason || undefined); setOpen(false); }}>Reject</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function LeadResultsTable({ leads, onApprove, onReject, onBulkAddToPipe, onEnrich, onBulkEnrich, onGenerateOutreach, enrichingIds = new Set(), generatingOutreachId }: LeadResultsTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (leads.length === 0) return null;

  const pendingLeads = leads.filter((l) => l.status === "pending");
  const allPendingSelected = pendingLeads.length > 0 && pendingLeads.every((l) => selected.has(l.id));

  const toggleAll = () => {
    if (allPendingSelected) setSelected(new Set());
    else setSelected(new Set(pendingLeads.map((l) => l.id)));
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const selectedPending = [...selected].filter((id) => leads.find((l) => l.id === id)?.status === "pending");
  const selectedUnenriched = [...selected].filter((id) => {
    const l = leads.find((l) => l.id === id);
    return l && l.research_depth !== "enriched";
  });

  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-medium text-primary">
          {leads.length} result{leads.length !== 1 ? "s" : ""} found
        </p>
        <div className="flex items-center gap-2">
          {onBulkEnrich && selectedUnenriched.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { onBulkEnrich(selectedUnenriched); setSelected(new Set()); }}
              className="gap-1.5 text-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Enrich ({selectedUnenriched.length})
            </Button>
          )}
          <Button
            size="sm"
            disabled={selectedPending.length === 0}
            onClick={() => { onBulkAddToPipe(selectedPending); setSelected(new Set()); }}
            className="gap-1.5 bg-gradient-to-r from-primary to-[hsl(160,60%,38%)] hover:from-primary/90 hover:to-[hsl(160,60%,34%)] text-primary-foreground shadow-md"
          >
            <Plus className="h-3.5 w-3.5" />
            Add to Pipe {selectedPending.length > 0 && `(${selectedPending.length})`}
          </Button>
        </div>
      </div>

      <div className="border border-border/40 rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10 text-center"><Checkbox checked={allPendingSelected} onCheckedChange={toggleAll} /></TableHead>
              <TableHead className="w-8"></TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">COMPANY</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">TYPE</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">FIT</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">LOCATION</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">CHAMPIONS</TableHead>
              <TableHead className="text-xs font-semibold text-right text-muted-foreground">ACTIONS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead, i) => (
              <ExpandableRow
                key={lead.id}
                lead={lead}
                index={i}
                selected={selected.has(lead.id)}
                onToggle={() => toggle(lead.id)}
                onApprove={() => onApprove(lead.id)}
                onReject={(reason) => onReject(lead.id, reason)}
                onEnrich={onEnrich ? () => onEnrich(lead.id) : undefined}
                onGenerateOutreach={onGenerateOutreach ? () => onGenerateOutreach(lead.id) : undefined}
                isEnriching={enrichingIds.has(lead.id)}
                isGeneratingOutreach={generatingOutreachId === lead.id}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function SearchLoadingAnimation() {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-in fade-in-0 duration-300">
      <div className="relative mb-8">
        <div className="absolute inset-[-12px] rounded-3xl bg-gradient-to-br from-primary/20 to-[hsl(160,60%,38%)]/20 animate-pulse" />
        <div className="absolute inset-[-6px] rounded-2xl bg-gradient-to-br from-primary/10 to-[hsl(160,60%,38%)]/10 animate-pulse" style={{ animationDelay: "150ms" }} />
        <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-[hsl(160,60%,38%)] flex items-center justify-center shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.5)]">
          <Loader2 className="h-7 w-7 text-primary-foreground animate-spin" />
        </div>
      </div>
      <div className="w-full max-w-2xl space-y-2 mb-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-muted/60 animate-pulse" style={{ animationDelay: `${i * 120}ms`, width: `${100 - i * 5}%`, margin: "0 auto" }} />
        ))}
      </div>
      <p className="text-sm font-medium text-foreground mb-1">Discovering leads via Exa…</p>
      <p className="text-xs text-muted-foreground">Searching company databases and filtering for your ICP</p>
    </div>
  );
}
