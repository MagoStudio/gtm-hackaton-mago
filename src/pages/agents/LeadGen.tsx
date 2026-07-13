import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AgentLayout } from "@/components/agents/AgentLayout";
import { LeadFilters, emptyFilters, type LeadFilterValues } from "@/components/agents/lead-gen/LeadFilters";
import { LeadSearchCenter } from "@/components/agents/lead-gen/LeadSearchCenter";
import { LeadResultsTable, SearchLoadingAnimation, type LeadResult } from "@/components/agents/lead-gen/LeadResultsTable";
import { UserSearch, Bookmark, ChevronDown, ChevronUp, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

function SaveAsICPButton({ query, onSave }: { query: string; onSave: (name: string, query: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs">
          <Bookmark className="h-3.5 w-3.5" />
          Save as ICP
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <p className="text-xs font-medium mb-2 text-foreground">Name this ICP</p>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Enterprise CTOs in SaaS"
          className="text-xs h-8 mb-2"
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) {
              onSave(name.trim(), query);
              setName("");
              setOpen(false);
            }
          }}
        />
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" className="h-7 text-xs" disabled={!name.trim()} onClick={() => { onSave(name.trim(), query); setName(""); setOpen(false); }}>Save</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SearchQueryDisplay({ query, resultCount }: { query: string; resultCount: number }) {
  const [open, setOpen] = useState(true);
  const isLong = query.length > 200;

  return (
    <div className="border border-border/40 rounded-xl bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Search className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Search query</p>
            {!isLong || open ? (
              <p className="text-sm text-foreground mt-0.5 break-words">{query}</p>
            ) : (
              <p className="text-sm text-foreground mt-0.5 break-words line-clamp-2">{query}</p>
            )}
          </div>
        </div>
        {isLong && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 shrink-0"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {open ? "Show less" : "Show more"}
          </Button>
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {resultCount} result{resultCount !== 1 ? "s" : ""} found
        </p>
      </div>
    </div>
  );
}

interface SavedICP {
  id: string;
  name: string;
  query: string;
  createdAt: string;
}

interface RecentSearch {
  query: string;
  results: LeadResult[];
  timestamp: string;
}

export default function LeadGen() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const autoSearched = useRef(false);
  // The ICP that launched the current search — tagged onto approved deals.
  const searchIcpKey = useRef<string | null>(null);
  const [filters, setFilters] = useState<LeadFilterValues>(emptyFilters);
  const [leads, setLeads] = useState<LeadResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [savedICPs, setSavedICPs] = useState<SavedICP[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [lastQuery, setLastQuery] = useState("");
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const [generatingOutreachId, setGeneratingOutreachId] = useState<string | undefined>();

  useEffect(() => {
    if (!user) return;
    supabase
      .from("agent_settings")
      .select("*")
      .eq("user_id", user.id)
      .eq("agent_type", "lead-gen-icps")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.settings) {
          const settings = data.settings as Record<string, unknown>;
          setSavedICPs((settings.icps as SavedICP[]) || []);
          const rawRecent = (settings.recent as any[]) || [];
          // Handle migration from old string[] format to RecentSearch[]
          const parsed: RecentSearch[] = rawRecent.map((r: any) =>
            typeof r === "string" ? { query: r, results: [], timestamp: "" } : r
          );
          setRecentSearches(parsed);
        }
      });
  }, [user]);

  const persistSettings = useCallback(
    async (icps: SavedICP[], recent: RecentSearch[]) => {
      if (!user) return;
      await supabase.from("agent_settings").upsert(
        { user_id: user.id, agent_type: "lead-gen-icps", settings: { icps, recent } as any },
        { onConflict: "user_id,agent_type" }
      );
    },
    [user]
  );

  const handleSearch = useCallback(
    async (query: string) => {
      if (!user) return;
      setIsSearching(true);
      setHasSearched(true);
      setLeads([]);
      setLastQuery(query);

      try {
        const { data, error } = await supabase.functions.invoke("discover-leads", {
          body: { query },
        });

        if (error) throw error;

        const rawLeads = (data?.leads || []).map((l: any) => ({
          id: l.id,
          company: l.company || "",
          contact_name: l.contact_name || "",
          job_title: l.job_title || "",
          email: l.email || "",
          linkedin_url: l.linkedin_url || "",
          company_size: l.company_size || "",
          vertical: l.vertical || "",
          location: l.location || "",
          source: l.source || "",
          status: l.status || "pending",
          summary: l.summary,
          fit_score: l.fit_score,
          fit_reason: l.fit_reason,
          pain_points: l.pain_points,
          tech_stack: l.tech_stack,
          product_hooks: l.product_hooks,
          champions: l.champions,
          recent_signals: l.recent_signals,
          research_depth: l.research_depth,
          last_enriched_at: l.last_enriched_at,
          
          website: l.website,
          region: l.region,
          employee_count: l.employee_count,
          funding_stage: l.funding_stage,
        })) as LeadResult[];

        setLeads(rawLeads);

        // Cache results in recent searches
        const recentEntry: RecentSearch = { query, results: rawLeads, timestamp: new Date().toISOString() };
        const newRecent = [recentEntry, ...recentSearches.filter((s) => s.query !== query)].slice(0, 10);
        setRecentSearches(newRecent);
        persistSettings(savedICPs, newRecent);

        toast.success(`${data?.inserted || 0} new leads discovered`);
      } catch (e: any) {
        console.error("Search error:", e);
        toast.error(e.message || "Search failed");
      } finally {
        setIsSearching(false);
      }
    },
    [user, recentSearches, savedICPs, persistSettings]
  );

  // Auto-run a search when arriving from the ICP page with a query.
  useEffect(() => {
    const state = location.state as { query?: string; icpKey?: string } | null;
    if (state?.icpKey) searchIcpKey.current = state.icpKey;
    if (state?.query && user && !autoSearched.current) {
      autoSearched.current = true;
      handleSearch(state.query);
    }
  }, [location.state, user, handleSearch]);

  const loadCachedSearch = useCallback(
    async (query: string) => {
      const cached = recentSearches.find((r) => r.query === query);
      if (cached && cached.results.length > 0) {
        setLastQuery(query);
        setHasSearched(true);
        // Show cached snapshot immediately
        setLeads(cached.results);

        // Re-fetch fresh rows from DB so enriched fields (added after the
        // original search) are visible when reopening a past search.
        try {
          const ids = cached.results.map((r) => r.id).filter(Boolean);
          if (ids.length > 0) {
            const { data: fresh, error } = await supabase
              .from("lead_candidates")
              .select("*")
              .in("id", ids);
            if (!error && fresh) {
              const freshMap = new Map(fresh.map((f: any) => [f.id, f]));
              const merged = cached.results.map((l) => {
                const f = freshMap.get(l.id);
                return f ? { ...l, ...f } : l;
              }) as LeadResult[];
              setLeads(merged);
              // Persist the refreshed snapshot back into recentSearches
              const updatedRecent = recentSearches.map((r) =>
                r.query === query ? { ...r, results: merged } : r
              );
              setRecentSearches(updatedRecent);
              persistSettings(savedICPs, updatedRecent);
            }
          }
        } catch (e) {
          console.error("Failed to refresh cached search:", e);
        }
      } else {
        handleSearch(query);
      }
    },
    [recentSearches, handleSearch, savedICPs, persistSettings]
  );


  const handleSaveICP = useCallback(
    async (name: string, query: string) => {
      const icp: SavedICP = { id: `icp-${Date.now()}`, name, query, createdAt: new Date().toISOString() };
      const updated = [icp, ...savedICPs];
      setSavedICPs(updated);
      persistSettings(updated, recentSearches);
      toast.success(`ICP "${name}" saved`);
    },
    [savedICPs, recentSearches, persistSettings]
  );

  const handleEnrich = useCallback(
    async (id: string) => {
      setEnrichingIds((prev) => new Set(prev).add(id));
      try {
        const { data, error } = await supabase.functions.invoke("enrich-lead", {
          body: { leadId: id },
        });
        if (error) throw error;

        const enrichment = data?.enriched?.[0] as Record<string, unknown> | undefined;
        if (enrichment) {
          setLeads((prev) =>
            prev.map((l) =>
              l.id === id
                ? { ...l, ...enrichment, research_depth: "enriched" as const, last_enriched_at: new Date().toISOString() }
                : l
            )
          );
          toast.success("Lead enriched");
        }
      } catch (e: any) {
        toast.error(e.message || "Enrichment failed");
      } finally {
        setEnrichingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      }
    },
    []
  );

  const handleBulkEnrich = useCallback(
    async (ids: string[]) => {
      setEnrichingIds(new Set(ids));
      try {
        const { data, error } = await supabase.functions.invoke("enrich-lead", {
          body: { leadIds: ids },
        });
        if (error) throw error;

        const enrichedMap = new Map((data?.enriched || []).map((e: any) => [e.id, e as Record<string, unknown>]));
        setLeads((prev) =>
          prev.map((l) => {
            const e = enrichedMap.get(l.id) as Record<string, unknown> | undefined;
            return e ? { ...l, ...e, research_depth: "enriched" as const, last_enriched_at: new Date().toISOString() } : l;
          })
        );
        toast.success(`${data?.total || 0} leads enriched`);
      } catch (e: any) {
        toast.error(e.message || "Bulk enrichment failed");
      } finally {
        setEnrichingIds(new Set());
      }
    },
    []
  );

  const handleGenerateOutreach = useCallback(
    async (id: string) => {
      setGeneratingOutreachId(id);
      try {
        const { data, error } = await supabase.functions.invoke("generate-outreach", {
          body: { leadId: id },
        });
        if (error) throw error;

        toast.success("Outreach email drafted", { description: data?.email?.subject });
      } catch (e: any) {
        toast.error(e.message || "Outreach generation failed");
      } finally {
        setGeneratingOutreachId(undefined);
      }
    },
    []
  );

  const getOrCreateLeadGenUpload = useCallback(async () => {
    if (!user) return null;
    const weekLabel = "Lead Gen";
    const { data: existing } = await supabase
      .from("uploads")
      .select("id")
      .eq("user_id", user.id)
      .eq("week_label", weekLabel)
      .maybeSingle();
    if (existing) return existing.id;
    const { data: created, error } = await supabase
      .from("uploads")
      .insert({ user_id: user.id, week_label: weekLabel, file_name: "lead-gen-agent" })
      .select("id")
      .single();
    if (error) { console.error("Failed to create Lead Gen upload", error); return null; }
    return created.id;
  }, [user]);

  const insertDealFromLead = useCallback(async (lead: LeadResult, uploadId: string) => {
    const nameParts = (lead.contact_name || "").split(" ");
    const { data: deal, error: dealError } = await supabase.from("deals").insert({
      upload_id: uploadId,
      status: "Lead",
      icp_key: searchIcpKey.current,
      first_name: nameParts[0] || null,
      last_name: nameParts.slice(1).join(" ") || null,
      company: lead.company || null,
      email: lead.email || null,
      linkedin_url: lead.linkedin_url || null,
      job_title: lead.job_title || null,
      company_size: lead.company_size || null,
      company_vertical: lead.vertical || null,
      country: lead.location || null,
      description: lead.summary || null,
    }).select("id").single();

    if (dealError || !deal) {
      console.error("Failed to insert deal", dealError);
      return;
    }

    // Auto-assign enriched champions as deal contacts
    if (lead.champions?.length) {
      const contacts = lead.champions.map((c) => {
        const parts = (c.name || "").trim().split(" ");
        return {
          deal_id: deal.id,
          is_champion: true,
          first_name: parts[0] || null,
          last_name: parts.slice(1).join(" ") || null,
          job_title: c.title || null,
          linkedin_url: c.linkedin_url || null,
          company: lead.company || null,
        };
      });
      const { error: contactsError } = await supabase.from("deal_contacts").insert(contacts);
      if (contactsError) console.error("Failed to insert champions as contacts", contactsError);
    }
  }, []);

  const handleApprove = useCallback(
    async (id: string) => {
      const lead = leads.find((l) => l.id === id);
      if (!lead || !user) return;

      const uploadId = await getOrCreateLeadGenUpload();
      if (!uploadId) { toast.error("Failed to create pipeline entry"); return; }

      const { error } = await supabase.from("lead_candidates").update({ status: "approved" }).eq("id", id);
      if (error) {
        toast.error("Failed to approve lead");
      } else {
        await insertDealFromLead(lead, uploadId);
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: "approved" } : l)));
        toast.success("Lead approved → added to Pipeline");
      }
    },
    [leads, user, getOrCreateLeadGenUpload, insertDealFromLead]
  );

  const handleReject = useCallback((id: string, reason?: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: "rejected", rejectionReason: reason } : l)));
    toast.info(reason ? `Lead rejected: ${reason}` : "Lead rejected");
  }, []);

  const handleBulkAddToPipe = useCallback(
    async (ids: string[]) => {
      if (!user) return;
      const uploadId = await getOrCreateLeadGenUpload();
      if (!uploadId) { toast.error("Failed to create pipeline entries"); return; }

      const { error } = await supabase
        .from("lead_candidates")
        .update({ status: "approved" })
        .in("id", ids);

      if (error) {
        toast.error("Failed to add leads to pipe");
      } else {
        const pendingLeads = leads.filter((l) => ids.includes(l.id) && l.status === "pending");
        await Promise.all(pendingLeads.map((l) => insertDealFromLead(l, uploadId)));
        setLeads((prev) =>
          prev.map((l) => (ids.includes(l.id) && l.status === "pending" ? { ...l, status: "approved" } : l))
        );
        toast.success(`${pendingLeads.length} lead${pendingLeads.length !== 1 ? "s" : ""} added to Pipeline`);
      }
    },
    [user, leads, getOrCreateLeadGenUpload, insertDealFromLead]
  );

  // Apply client-side filters
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (filters.fitScoreMin > 0 && (l.fit_score || 0) < filters.fitScoreMin) return false;
      if (filters.region && filters.region !== "all" && l.region && !l.region.toLowerCase().includes(filters.region.toLowerCase())) return false;
      return true;
    });
  }, [leads, filters]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AgentLayout title="Lead Gen Agent" icon={<UserSearch className="h-5 w-5 text-primary" />}>
      <div className="flex-1 flex min-h-0">
        <div className="w-[260px] shrink-0 border-r border-border/40 bg-card/50 overflow-y-auto hidden lg:block">
          <LeadFilters filters={filters} onChange={setFilters} />
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto">
          {!hasSearched ? (
            <LeadSearchCenter
              onSearch={handleSearch}
              isSearching={isSearching}
              savedICPs={savedICPs}
              recentSearches={recentSearches.map((r) => r.query)}
              onSaveICP={handleSaveICP}
              onLoadICP={(icp) => loadCachedSearch(icp.query)}
              onLoadRecent={(q) => loadCachedSearch(q)}
            />
          ) : (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setHasSearched(false); setLeads([]); setLastQuery(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← New search
                </button>
                <SaveAsICPButton query={lastQuery} onSave={handleSaveICP} />
              </div>

              {lastQuery && (
                <SearchQueryDisplay query={lastQuery} resultCount={filteredLeads.length} />
              )}

              {isSearching && <SearchLoadingAnimation />}
              <LeadResultsTable
                leads={filteredLeads}
                onApprove={handleApprove}
                onReject={handleReject}
                onBulkAddToPipe={handleBulkAddToPipe}
                onEnrich={handleEnrich}
                onBulkEnrich={handleBulkEnrich}
                onGenerateOutreach={handleGenerateOutreach}
                enrichingIds={enrichingIds}
                generatingOutreachId={generatingOutreachId}
              />
            </div>
          )}
        </div>
      </div>
    </AgentLayout>
  );
}
