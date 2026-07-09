import { useState, useCallback } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AgentLayout } from "@/components/agents/AgentLayout";
import { AgentChat } from "@/components/agents/AgentChat";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ToolCall } from "@/lib/agent-stream";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DraftEmail {
  id: string;
  subject: string;
  body: string;
  recipientName?: string;
  recipientEmail?: string;
  status: "draft" | "saved";
}

export default function CrmAgent() {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const dealId = searchParams.get("dealId");
  const [emails, setEmails] = useState<DraftEmail[]>([]);

  const handleToolCall = useCallback((tc: ToolCall) => {
    if (tc.name === "draft_email") {
      const args = tc.arguments as any;
      const email: DraftEmail = {
        id: `email-${Date.now()}`,
        subject: args.subject,
        body: args.body,
        recipientName: args.recipient_name,
        recipientEmail: args.recipient_email,
        status: "draft",
      };
      setEmails((prev) => [email, ...prev]);
      toast.success("Email drafted");
    }
  }, []);

  const saveEmail = useCallback(async (email: DraftEmail) => {
    if (!user) return;
    const { error } = await supabase.from("outreach_emails").insert({
      user_id: user.id,
      deal_id: dealId || null,
      recipient_email: email.recipientEmail,
      recipient_name: email.recipientName,
      subject: email.subject,
      body: email.body,
      status: "draft",
    });
    if (error) toast.error("Failed to save email");
    else {
      setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, status: "saved" } : e)));
      toast.success("Email saved to queue");
    }
  }, [user, dealId]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const context = dealId ? { dealId } : undefined;

  return (
    <AgentLayout title="CRM & Outreach" icon={<Mail className="h-5 w-5 text-primary" />}>
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <div className="flex-1 min-w-0 border-r border-border/40">
          <AgentChat agentType="crm" context={context} onToolCall={handleToolCall} />
        </div>
        <div className="w-full lg:w-[400px] shrink-0 overflow-y-auto p-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Email Drafts</CardTitle>
            </CardHeader>
            <CardContent>
              {emails.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Chat with the agent to draft outreach emails
                </p>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-3">
                    {emails.map((email) => (
                      <div key={email.id} className="rounded-lg border border-border/30 bg-secondary/30 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold truncate">{email.subject}</p>
                          <Badge variant={email.status === "saved" ? "default" : "outline"} className="text-[10px] shrink-0">
                            {email.status}
                          </Badge>
                        </div>
                        {email.recipientName && (
                          <p className="text-[11px] text-muted-foreground">To: {email.recipientName} {email.recipientEmail ? `<${email.recipientEmail}>` : ""}</p>
                        )}
                        <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{email.body}</p>
                        {email.status === "draft" && (
                          <Button size="sm" variant="secondary" className="h-7 text-xs w-full" onClick={() => saveEmail(email)}>
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
