import { useState, useEffect } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AgentLayout } from "@/components/agents/AgentLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Bot, Save, Plus, Trash2, MessageSquare, Sparkles } from "lucide-react";

interface BotConfig {
  id: string;
  name: string;
  soul: string;
  identity: { emoji: string; vibe: string };
  user_profile: string;
  instructions: string;
  tools_notes: string;
  model_preference: string;
}

interface BotSkill {
  id: string;
  bot_id: string;
  name: string;
  description: string;
  instructions: string;
  tool_definitions: any[];
  enabled: boolean;
}

const DEFAULT_CONFIG: Omit<BotConfig, "id"> = {
  name: "ClawBot",
  soul: "You are a direct, helpful sales AI. You speak concisely and always back up insights with data from the pipeline. You proactively identify risks and opportunities.",
  identity: { emoji: "🤖", vibe: "professional" },
  user_profile: "",
  instructions: "Help the user manage their sales pipeline. When asked about any specific deal, ALWAYS call get_deal_details first. When asked about pipeline health, call query_pipeline. When the user mentions a company or person by name, call search_deals first.",
  tools_notes: "Always prefer fetching real data over making assumptions. If you're unsure which deal the user means, search first.",
  model_preference: "google/gemini-2.5-flash",
};

const MODEL_OPTIONS = [
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Fast)" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (Best)" },
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (Latest)" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini" },
  { value: "openai/gpt-5", label: "GPT-5 (Premium)" },
];

export default function OpenClawConfig() {
  const { user, loading: authLoading } = useAuth();
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [skills, setSkills] = useState<BotSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadConfig();
  }, [user]);

  const loadConfig = async () => {
    setLoading(true);
    const { data: configs } = await supabase
      .from("bot_configs")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at")
      .limit(1);

    if (configs && configs.length > 0) {
      const c = configs[0];
      setConfig({
        id: c.id,
        name: c.name,
        soul: c.soul || "",
        identity: (c.identity as any) || { emoji: "🤖", vibe: "professional" },
        user_profile: c.user_profile || "",
        instructions: c.instructions || "",
        tools_notes: c.tools_notes || "",
        model_preference: c.model_preference || "google/gemini-2.5-flash",
      });

      const { data: skillData } = await supabase
        .from("bot_skills")
        .select("*")
        .eq("bot_id", c.id)
        .order("created_at");
      setSkills((skillData as any[]) || []);
    } else {
      // Create default config
      const { data: newConfig, error } = await supabase
        .from("bot_configs")
        .insert({ user_id: user!.id, ...DEFAULT_CONFIG, identity: DEFAULT_CONFIG.identity })
        .select()
        .single();
      if (newConfig) {
        setConfig({
          id: newConfig.id,
          name: newConfig.name,
          soul: newConfig.soul || "",
          identity: (newConfig.identity as any) || { emoji: "🤖", vibe: "professional" },
          user_profile: newConfig.user_profile || "",
          instructions: newConfig.instructions || "",
          tools_notes: newConfig.tools_notes || "",
          model_preference: newConfig.model_preference || "google/gemini-2.5-flash",
        });
      }
      if (error) console.error("Error creating config:", error);
    }
    setLoading(false);
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    const { error } = await supabase
      .from("bot_configs")
      .update({
        name: config.name,
        soul: config.soul,
        identity: config.identity,
        user_profile: config.user_profile,
        instructions: config.instructions,
        tools_notes: config.tools_notes,
        model_preference: config.model_preference,
        updated_at: new Date().toISOString(),
      })
      .eq("id", config.id);

    if (error) {
      toast.error("Failed to save configuration");
    } else {
      toast.success("Configuration saved");
    }
    setSaving(false);
  };

  const addSkill = async () => {
    if (!config) return;
    const { data, error } = await supabase
      .from("bot_skills")
      .insert({
        bot_id: config.id,
        name: "New Skill",
        description: "",
        instructions: "",
        tool_definitions: [],
        enabled: true,
      })
      .select()
      .single();
    if (data) setSkills((prev) => [...prev, data as any]);
    if (error) toast.error("Failed to create skill");
  };

  const updateSkill = async (skillId: string, updates: Partial<BotSkill>) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === skillId ? { ...s, ...updates } : s))
    );
    const { error } = await supabase
      .from("bot_skills")
      .update(updates)
      .eq("id", skillId);
    if (error) toast.error("Failed to update skill");
  };

  const deleteSkill = async (skillId: string) => {
    const { error } = await supabase.from("bot_skills").delete().eq("id", skillId);
    if (!error) setSkills((prev) => prev.filter((s) => s.id !== skillId));
    else toast.error("Failed to delete skill");
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AgentLayout title="ClawBot Config" icon={<Bot className="h-5 w-5 text-primary" />}>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Configure Your Bot</h2>
            <p className="text-sm text-muted-foreground">Edit the soul, identity, and skills of your ClawBot</p>
          </div>
          <div className="flex gap-2">
            <Link to="/agents/openclaw">
              <Button variant="outline" size="sm" className="gap-1.5">
                <MessageSquare className="h-4 w-4" />
                Chat
              </Button>
            </Link>
            <Button size="sm" onClick={saveConfig} disabled={saving} className="gap-1.5">
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="soul" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="soul">Soul</TabsTrigger>
            <TabsTrigger value="identity">Identity</TabsTrigger>
            <TabsTrigger value="instructions">Instructions</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
          </TabsList>

          <TabsContent value="soul" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Soul — Persona & Tone</CardTitle>
                <CardDescription>Define who your bot is, its personality, boundaries, and communication style.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Soul Definition</Label>
                  <Textarea
                    value={config?.soul || ""}
                    onChange={(e) => setConfig((c) => c ? { ...c, soul: e.target.value } : c)}
                    placeholder="You are a direct, helpful sales AI..."
                    className="min-h-[200px] font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>User Profile</Label>
                  <Textarea
                    value={config?.user_profile || ""}
                    onChange={(e) => setConfig((c) => c ? { ...c, user_profile: e.target.value } : c)}
                    placeholder="Information about the user (role, company, preferences)..."
                    className="min-h-[100px] text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="identity" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Identity</CardTitle>
                <CardDescription>Name, emoji, and vibe of your bot.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bot Name</Label>
                    <Input
                      value={config?.name || ""}
                      onChange={(e) => setConfig((c) => c ? { ...c, name: e.target.value } : c)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Emoji</Label>
                    <Input
                      value={config?.identity?.emoji || ""}
                      onChange={(e) => setConfig((c) => c ? { ...c, identity: { ...c.identity, emoji: e.target.value } } : c)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Vibe</Label>
                  <Input
                    value={config?.identity?.vibe || ""}
                    onChange={(e) => setConfig((c) => c ? { ...c, identity: { ...c.identity, vibe: e.target.value } } : c)}
                    placeholder="professional, casual, witty..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <select
                    value={config?.model_preference || ""}
                    onChange={(e) => setConfig((c) => c ? { ...c, model_preference: e.target.value } : c)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="instructions" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Operating Instructions</CardTitle>
                <CardDescription>How the bot should behave, what to prioritize, and tool usage guidelines.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Instructions</Label>
                  <Textarea
                    value={config?.instructions || ""}
                    onChange={(e) => setConfig((c) => c ? { ...c, instructions: e.target.value } : c)}
                    placeholder="Help the user manage their sales pipeline..."
                    className="min-h-[200px] font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tool Usage Notes</Label>
                  <Textarea
                    value={config?.tools_notes || ""}
                    onChange={(e) => setConfig((c) => c ? { ...c, tools_notes: e.target.value } : c)}
                    placeholder="Always prefer fetching real data over making assumptions..."
                    className="min-h-[100px] font-mono text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="skills" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Skills</h3>
                <p className="text-xs text-muted-foreground">Modular capabilities your bot can use</p>
              </div>
              <Button size="sm" variant="outline" onClick={addSkill} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add Skill
              </Button>
            </div>

            {skills.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Sparkles className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No skills yet. Add one to extend your bot's capabilities.</p>
                </CardContent>
              </Card>
            )}

            {skills.map((skill) => (
              <Card key={skill.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <Switch
                        checked={skill.enabled}
                        onCheckedChange={(checked) => updateSkill(skill.id, { enabled: checked })}
                      />
                      <Input
                        value={skill.name}
                        onChange={(e) => updateSkill(skill.id, { name: e.target.value })}
                        className="text-sm font-semibold h-8 max-w-[200px]"
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteSkill(skill.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Input
                      value={skill.description}
                      onChange={(e) => updateSkill(skill.id, { description: e.target.value })}
                      placeholder="What this skill does..."
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Instructions</Label>
                    <Textarea
                      value={skill.instructions}
                      onChange={(e) => updateSkill(skill.id, { instructions: e.target.value })}
                      placeholder="Detailed instructions for this skill..."
                      className="min-h-[80px] text-sm font-mono"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AgentLayout>
  );
}
