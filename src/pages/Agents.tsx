import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, UserSearch, GitBranch, Mail, Share2, ArrowRight, Settings } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";

const AGENTS = [
  {
    id: "lead-gen",
    title: "Lead Gen",
    description: "Discover and qualify potential leads based on your Ideal Customer Profile. Get AI-powered suggestions and approve them into your pipeline.",
    icon: UserSearch,
    color: "text-[hsl(var(--info))]",
    bg: "bg-[hsl(var(--info))]/10",
  },
  {
    id: "pipeline",
    title: "Pipeline Manager",
    description: "Get insights on your deal pipeline, identify at-risk deals, and receive prioritized action suggestions.",
    icon: GitBranch,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    id: "crm",
    title: "CRM & Outreach",
    description: "Draft personalized outreach emails, create follow-up sequences, and manage your communication pipeline.",
    icon: Mail,
    color: "text-[hsl(var(--warning))]",
    bg: "bg-[hsl(var(--warning))]/10",
  },
  {
    id: "social",
    title: "Social Media",
    description: "Generate engaging social media content, create post variants, and manage your content calendar.",
    icon: Share2,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
];

export default function Agents() {
  const { user, loading } = useAuth();

  const { data: botConfig } = useQuery({
    queryKey: ['bot-config-name', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('bot_configs')
        .select('name, identity')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const botName = botConfig?.name || 'ClawBot';
  const botEmoji = (botConfig?.identity as any)?.emoji || '🤖';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
  );
}
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="text-center mb-10">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <Bot className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-2">AI Agents Hub</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Your team of AI agents that learn your preferences and help you close deals faster.
          </p>
        </div>

        {/* Featured: ClawBot */}
        <Link to="/agents/openclaw">
          <Card className="mb-6 hover:border-primary/30 transition-all hover:shadow-lg group cursor-pointer border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-xl">
                  {botEmoji}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">{botName}</CardTitle>
                  <CardDescription className="text-xs mt-0.5">Your AI sales assistant with full pipeline access, memory, and configurable personality.</CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  <Link to="/agents/openclaw/config" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </Link>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AGENTS.map((agent) => (
            <Link key={agent.id} to={`/agents/${agent.id}`}>
              <Card className="h-full hover:border-primary/30 transition-all hover:shadow-md group cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl ${agent.bg} flex items-center justify-center`}>
                      <agent.icon className={`h-5 w-5 ${agent.color}`} />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">{agent.title}</CardTitle>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs leading-relaxed">
                    {agent.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </AppLayout>
  );
}
