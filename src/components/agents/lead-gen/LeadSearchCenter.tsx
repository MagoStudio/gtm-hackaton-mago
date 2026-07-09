import { useState } from "react";
import { Search, Sparkles, Save, Clock, Bookmark } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { IcpDefinition } from "./IcpDefinition";

interface SavedICP {
  id: string;
  name: string;
  query: string;
  createdAt: string;
}

interface LeadSearchCenterProps {
  onSearch: (query: string) => void;
  isSearching: boolean;
  savedICPs: SavedICP[];
  recentSearches: string[];
  onSaveICP: (name: string, query: string) => void;
  onLoadICP: (icp: SavedICP) => void;
  onLoadRecent: (query: string) => void;
}

export function LeadSearchCenter({
  onSearch,
  isSearching,
  savedICPs,
  recentSearches,
  onSaveICP,
  onLoadICP,
  onLoadRecent,
}: LeadSearchCenterProps) {
  const [query, setQuery] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [icpName, setIcpName] = useState("");

  const handleSearch = () => {
    if (!query.trim() || isSearching) return;
    onSearch(query.trim());
  };

  const handleSave = () => {
    if (!icpName.trim() || !query.trim()) return;
    onSaveICP(icpName.trim(), query.trim());
    setIcpName("");
    setShowSaveDialog(false);
  };

  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 max-w-2xl mx-auto w-full">
      <h2 className="text-2xl font-bold text-foreground mb-8">Start your search with AI</h2>

      {/* Search bar */}
      <div className="w-full relative flex items-center gap-2 mb-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="E.g Engineers in New York in software companies with more than 500 employees"
            className="pl-10 pr-4 h-12 text-sm bg-background border-border/60 rounded-xl"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={!query.trim() || isSearching}
          className={cn(
            "h-12 px-6 rounded-xl font-semibold text-sm gap-2 transition-all duration-300",
            "bg-gradient-to-r from-[hsl(262,80%,58%)] to-[hsl(280,80%,60%)]",
            "hover:from-[hsl(262,80%,52%)] hover:to-[hsl(280,80%,54%)]",
            "text-white shadow-[0_4px_20px_-4px_hsl(262,80%,58%/0.5)]",
            "hover:shadow-[0_6px_28px_-4px_hsl(262,80%,58%/0.6)]",
            "active:scale-[0.97]",
            "disabled:opacity-50 disabled:shadow-none"
          )}
        >
          <Sparkles className="h-4 w-4" />
          AI Search
        </Button>
      </div>

      {/* Save ICP button */}
      <div className="w-full flex justify-end mb-6">
        {!showSaveDialog ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
            onClick={() => setShowSaveDialog(true)}
            disabled={!query.trim()}
          >
            <Save className="h-3.5 w-3.5" />
            Save as ICP
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              value={icpName}
              onChange={(e) => setIcpName(e.target.value)}
              placeholder="ICP name…"
              className="h-8 text-xs w-40"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setShowSaveDialog(false);
              }}
              autoFocus
            />
            <Button size="sm" className="h-8 text-xs" onClick={handleSave}>
              Save
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Structured ICP definition (Sillage persona) */}
      <div className="w-full mb-4">
        <IcpDefinition />
      </div>

      {/* Saved ICPs + Recent Searches */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/40">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-muted-foreground" />
              Saved ICPs
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {savedICPs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No saved ICPs yet</p>
            ) : (
              <div className="space-y-1.5">
                {savedICPs.map((icp) => (
                  <button
                    key={icp.id}
                    onClick={() => {
                      setQuery(icp.query);
                      onLoadICP(icp);
                    }}
                    className="w-full text-left text-xs py-1.5 px-2 rounded-md hover:bg-accent/60 transition-colors text-foreground truncate"
                  >
                    <span className="font-medium">{icp.name}</span>
                    <span className="text-muted-foreground ml-1.5">· {icp.query.slice(0, 50)}…</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/40">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Recent Searches
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {recentSearches.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recent searches</p>
            ) : (
              <div className="space-y-1.5">
                {recentSearches.slice(0, 5).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuery(s);
                      onLoadRecent(s);
                    }}
                    className="w-full text-left text-xs py-1.5 px-2 rounded-md hover:bg-accent/60 transition-colors text-muted-foreground truncate"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
