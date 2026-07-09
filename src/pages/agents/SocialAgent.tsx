import { useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AgentLayout } from "@/components/agents/AgentLayout";
import { AgentChat } from "@/components/agents/AgentChat";
import { Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ToolCall } from "@/lib/agent-stream";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ContentDraft {
  id: string;
  platform: string;
  postText: string;
  status: "draft" | "saved";
}

export default function SocialAgent() {
  const { user, loading } = useAuth();
  const [content, setContent] = useState<ContentDraft[]>([]);

  const handleToolCall = useCallback((tc: ToolCall) => {
    if (tc.name === "create_content") {
      const args = tc.arguments as any;
      const item: ContentDraft = {
        id: `content-${Date.now()}`,
        platform: args.platform || "linkedin",
        postText: args.post_text,
        status: "draft",
      };
      setContent((prev) => [item, ...prev]);
      toast.success("Content created");
    }
  }, []);

  const saveContent = useCallback(async (item: ContentDraft) => {
    if (!user) return;
    const { error } = await supabase.from("social_content").insert({
      user_id: user.id,
      platform: item.platform,
      post_text: item.postText,
      status: "draft",
    });
    if (error) toast.error("Failed to save content");
    else {
      setContent((prev) => prev.map((c) => (c.id === item.id ? { ...c, status: "saved" } : c)));
      toast.success("Content saved");
    }
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AgentLayout title="Social Media" icon={<Share2 className="h-5 w-5 text-primary" />}>
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <div className="flex-1 min-w-0 border-r border-border/40">
          <AgentChat agentType="social" onToolCall={handleToolCall} />
        </div>
        <div className="w-full lg:w-[400px] shrink-0 overflow-y-auto p-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Content Queue</CardTitle>
            </CardHeader>
            <CardContent>
              {content.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Chat with the agent to create content
                </p>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-3">
                    {content.map((item) => (
                      <div key={item.id} className="rounded-lg border border-border/30 bg-secondary/30 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[10px]">{item.platform}</Badge>
                          <Badge variant={item.status === "saved" ? "default" : "outline"} className="text-[10px]">
                            {item.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-foreground whitespace-pre-wrap">{item.postText}</p>
                        {item.status === "draft" && (
                          <Button size="sm" variant="secondary" className="h-7 text-xs w-full" onClick={() => saveContent(item)}>
                            Save to Queue
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AgentLayout>
  );
}
