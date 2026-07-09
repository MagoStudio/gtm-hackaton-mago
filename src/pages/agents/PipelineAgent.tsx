import { useState, useCallback, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AgentLayout } from "@/components/agents/AgentLayout";
import { AgentChat } from "@/components/agents/AgentChat";
import { ActionQueue, type QueueItem } from "@/components/agents/ActionQueue";
import { GitBranch } from "lucide-react";
import { useUploads, useDealsForUpload } from "@/hooks/useDeals";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ToolCall } from "@/lib/agent-stream";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PipelineAgent() {
  const { user, loading } = useAuth();
  const { data: uploads = [] } = useUploads();
  const latestUploadId = uploads[0]?.id ?? null;
  const { data: deals = [] } = useDealsForUpload(latestUploadId);
  const [actions, setActions] = useState<QueueItem[]>([]);
  const [rawActions, setRawActions] = useState<Record<string, any>>({});

  const pipelineContext = useMemo(() => {
    if (deals.length === 0) return undefined;
    const statusCounts: Record<string, number> = {};
    let totalValue = 0;
    for (const d of deals) {
      statusCounts[d.status] = (statusCounts[d.status] || 0) + 1;
      totalValue += d.deal_value || 0;
    }
    return {
      totalDeals: deals.length,
      totalValue,
      statusCounts,
      deals: deals.slice(0, 20).map((d) => ({
        id: d.id,
        company: d.company,
        contact: `${d.first_name || ""} ${d.last_name || ""}`.trim(),
        status: d.status,
        value: d.deal_value,
        lastInteraction: d.last_interaction,
      })),
    };
  }, [deals]);

  const handleToolCall = useCallback((tc: ToolCall) => {
    if (tc.name === "suggest_actions" && tc.arguments.actions) {
      const newActions = (tc.arguments.actions as any[]).map((a, i) => {
        const id = `action-${Date.now()}-${i}`;
        setRawActions((prev) => ({ ...prev, [id]: a }));
        return {
          id,
          title: a.summary,
          subtitle: a.action_type,
          status: "pending",
          priority: a.priority || "medium",
        };
      });
      setActions((prev) => [...newActions, ...prev]);
      toast.success(`${newActions.length} action(s) suggested`);
    }
  }, []);

  const handleApprove = useCallback(async (id: string) => {
    const action = rawActions[id];
    if (!action || !user) return;

    const { error } = await supabase.from("pipeline_actions").insert({
      user_id: user.id,
      deal_id: action.deal_id || null,
      action_type: action.action_type,
      summary: action.summary,
      priority: action.priority || "medium",
      status: "approved",
    });

    if (error) toast.error("Failed to save action");
    else {
      setActions((prev) => prev.map((a) => (a.id === id ? { ...a, status: "approved" } : a)));
      toast.success("Action approved");
    }
  }, [rawActions, user]);

  const handleReject = useCallback((id: string) => {
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, status: "rejected" } : a)));
  }, []);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AgentLayout title="Pipeline Manager" icon={<GitBranch className="h-5 w-5 text-primary" />}>
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <div className="flex-1 min-w-0 border-r border-border/40">
          <AgentChat agentType="pipeline" context={pipelineContext} onToolCall={handleToolCall} />
        </div>
        <div className="w-full lg:w-[400px] shrink-0 overflow-y-auto p-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Suggested Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionQueue
                items={actions}
                onApprove={handleApprove}
                onReject={handleReject}
                emptyMessage="Chat with the agent to get action suggestions"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </AgentLayout>
  );
}
