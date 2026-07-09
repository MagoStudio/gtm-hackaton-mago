import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AgentLayout } from "@/components/agents/AgentLayout";
import { AgentChat } from "@/components/agents/AgentChat";
import { Bot } from "lucide-react";

export default function OpenClaw() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AgentLayout title="ClawBot" icon={<Bot className="h-5 w-5 text-primary" />}>
      <AgentChat agentType="openclaw" className="flex-1" />
    </AgentLayout>
  );
}
