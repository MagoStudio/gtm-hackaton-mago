import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Workflow, Trash2, Play, Loader2, Save } from "lucide-react";
import { SequenceStepsEditor, newStep, type Step } from "@/components/SequenceStepsEditor";

interface Sequence { id: string; name: string; steps: Step[]; created_at: string }

export default function Sequences() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<Step[]>([newStep(true)]);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("sequences").select("id, name, steps, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
    setSequences((data as unknown as Sequence[]) || []);
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!user || !name.trim()) { toast.error("Name your sequence"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from("sequences").insert({
        user_id: user.id, name: name.trim(), steps: steps as any,
      }).select("id").single();
      if (error) throw error;
      toast.success("Sequence saved — attach ICPs to run it");
      navigate(`/sequences/${data.id}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally { setSaving(false); }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("run-sequences", { body: {} });
      if (error) throw error;
      toast.success(`Processed ${data.processed} · sent ${data.sent} · drafted ${data.drafted}`);
    } catch (e: any) {
      toast.error(e.message || "Run failed");
    } finally { setRunning(false); }
  };

  const remove = async (id: string) => {
    await supabase.from("sequences").delete().eq("id", id);
    load();
  };

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl w-full px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
              <Workflow className="h-6 w-6 text-primary" /> Sequences
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Multi-step email outreach. Enroll leads from the pipeline; the sequencer sends each step on schedule.
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={runNow} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run due steps now
          </Button>
        </div>

        {/* Builder */}
        <Card className="border-border/40">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">New sequence</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sequence name (e.g. Tier 2 – warm outbound)" className="h-8 text-xs" />

            <SequenceStepsEditor steps={steps} onChange={setSteps} />

            <div className="flex justify-end">
              <Button size="sm" className="gap-1.5 text-xs" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save sequence
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Existing */}
        {sequences.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Your sequences</p>
            {sequences.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-card px-4 py-3 hover:border-primary/50 transition-colors">
                <button onClick={() => navigate(`/sequences/${s.id}`)} className="text-left flex-1">
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{(s.steps || []).length} step{(s.steps || []).length !== 1 ? "s" : ""} · open to attach ICPs & run</p>
                </button>
                <button onClick={() => remove(s.id)} className="text-muted-foreground hover:text-destructive ml-2">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
