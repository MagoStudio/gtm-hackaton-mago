import { useAuth } from "@/hooks/useAuth";
import { useGmailConnection } from "@/hooks/useGmailConnection";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { AgentKeyManager } from "@/components/AgentKeyManager";
import { AuditFeed } from "@/components/AuditFeed";

export default function Settings() {
  const { user } = useAuth();
  const {
    isConnected,
    isCheckingConnection,
    connectedEmail,
    lastSynced,
    connectGmail,
  } = useGmailConnection();

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-8 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your account and integrations</p>
        </div>

        {/* Gmail Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                  <Mail className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Gmail</CardTitle>
                  <CardDescription>
                    Sync emails and send messages from your Gmail account
                  </CardDescription>
                </div>
              </div>
              {isCheckingConnection ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : isConnected ? (
                <Badge variant="secondary" className="gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1.5">
                  <AlertCircle className="h-3 w-3" />
                  Not connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isConnected ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{connectedEmail}</p>
                    {lastSynced && (
                      <p className="text-xs text-muted-foreground">
                        Last synced {new Date(lastSynced).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={connectGmail}>
                  Reconnect with updated permissions
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Connect your Gmail account to sync deal emails and send follow-ups directly from the app or via Claude MCP.
                </p>
                <Button onClick={connectGmail} className="gap-2">
                  <Mail className="h-4 w-4" />
                  Connect Gmail
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{user?.email}</p>
                <p className="text-xs text-muted-foreground">Free plan</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Agent API Keys */}
        <AgentKeyManager />

        {/* Activity Feed */}
        <AuditFeed />
      </div>
    </AppLayout>
  );
}
