import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Workflow, Plus, Trash2, Play, Mail, Clock, Loader2, Save, Target, Users, Send } from "lucide-react";

interface Step { channel: "email"; delay_hours: number; subject: string; body: string }
interface IcpOption { icp_key: string; name: string }

const newStep = (first: boolean): Step => ({ channel: "email", delay_hours: first ? 0 : 48, subject: "", body: "" });

export default function SequenceDetail() {
  const { user, loading } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [icpKeys, setIcpKeys] = useState<string[]>([]);
  const [icpOptions, setIcpOptions] = useState<IcpOption[]>([]);
  const [loadingRow, setLoadingRow] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [enrolledCount, setEnrolledCount] = useState<number | null>(null);
  const [testEmails, setTestEmails] = useState("");
  const [testing, setTesting] = useState(false);

  const loadEnrolled = useCallback(async () => {
    if (!id) return;
    const { count } = await supabase.from("sequence_enrollments").select("id", { count: "exact", head: true }).eq("sequence_id", id);
    setEnrolledCount(count ?? 0);
  }, [id]);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const [{ data: seq }, { data: icps }] = await Promise.all([
        supabase.from("sequences").select("*").eq("id", id).maybeSingle(),
        supabase.from("icps").select("icp_key, name, version").eq("user_id", user.id).order("version", { ascending: false }),
      ]);
      if (seq) {
        setName(seq.name);
        setSteps(((seq.steps as unknown as Step[]) || []).length ? (seq.steps as unknown as Step[]) : [newStep(true)]);
        setIcpKeys((seq.icp_keys as string[]) || []);
      }
      // latest ICP name per icp_key
      const seen = new Map<string, IcpOption>();
      for (const r of (icps as any[]) || []) if (!seen.has(r.icp_key)) seen.set(r.icp_key, { icp_key: r.icp_key, name: r.name });
      setIcpOptions([...seen.values()]);
      setLoadingRow(false);
      loadEnrolled();
    })();
  }, [id, user, loadEnrolled]);

  const setStep = (i: number, patch: Partial<Step>) => setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));
  const toggleIcp = (key: string) => setIcpKeys((k) => (k.includes(key) ? k.filter((x) => x !== key) : [...k, key]));

  const save = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("sequences").update({ name, steps: steps as any, icp_keys: icpKeys, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      toast.success("Sequence saved");
    } catch (e: any) { toast.error(e.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  // Enroll every lead from the attached ICP(s) that isn't already in this
  // sequence, then run the sequencer to process the due first steps.
  const enrollAndRun = async () => {
    if (!id || !user) return;
    if (icpKeys.length === 0) { toast.error("Attach at least one ICP first"); return; }
    setRunning(true);
    try {
      await save();
      const { data: deals } = await supabase.from("deals").select("id").in("icp_key", icpKeys);
      const dealIds = (deals || []).map((d) => d.id);
      if (dealIds.length === 0) { toast.info("No leads tagged to these ICPs yet — run a lead search from the ICP first"); setRunning(false); return; }

      const { data: existing } = await supabase.from("sequence_enrollments").select("deal_id").eq("sequence_id", id).in("deal_id", dealIds);
      const already = new Set((existing || []).map((e) => e.deal_id));
      const toEnroll = dealIds.filter((d) => !already.has(d));

      if (toEnroll.length > 0) {
        const rows = toEnroll.map((deal_id) => ({ user_id: user.id, sequence_id: id, deal_id, current_step: 0, next_action_at: new Date().toISOString() }));
        const { error } = await supabase.from("sequence_enrollments").insert(rows);
        if (error) throw error;
      }

      const { data: res, error: runErr } = await supabase.functions.invoke("run-sequences", { body: {} });
      if (runErr) throw runErr;
      toast.success(`Enrolled ${toEnroll.length} new lead(s) · processed ${res?.processed ?? 0} · sent ${res?.sent ?? 0} · drafted ${res?.drafted ?? 0}`);
      loadEnrolled();
    } catch (e: any) { toast.error(e.message || "Run failed"); }
    finally { setRunning(false); }
  };

  const sendTest = async () => {
    const emails = testEmails.split(/[,\n]/).map((e) => e.trim()).filter(Boolean);
    if (emails.length === 0) { toast.error("Add at least one test email"); return; }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-test-sequence", { body: { steps, emails } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Sent ${data.sent} test email(s) — ${data.steps} step(s) × ${data.recipients} recipient(s)`);
    } catch (e: any) { toast.error(e.message || "Test send failed"); }
    finally { setTesting(false); }
  };

  if (loading || loadingRow) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl w-full px-6 py-8 space-y-5">
            <div className="flex items-center gap-2.5">
              <Workflow className="h-6 w-6 text-primary" />
              <Input value={name} onChange={(e) => setName(e.target.value)} className="text-lg font-bold h-9 max-w-sm" />
              {enrolledCount !== null && <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3.5 w-3.5" />{enrolledCount} enrolled</span>}
            </div>

            {/* Attached ICPs */}
            <Card className="border-border/40">
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Target ICPs</CardTitle>
                <p className="text-xs text-muted-foreground">Leads tagged to these ICPs are enrolled when you run the sequence.</p>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {icpOptions.length === 0
                  ? <p className="text-xs text-muted-foreground">No ICPs yet — create one on the ICP page.</p>
                  : icpOptions.map((o) => (
                    <label key={o.icp_key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={icpKeys.includes(o.icp_key)} onCheckedChange={() => toggleIcp(o.icp_key)} />
                      {o.name}
                    </label>
                  ))}
              </CardContent>
            </Card>

            {/* Steps */}
            <Card className="border-border/40">
              <CardHeader className="pb-3 pt-4 px-4"><CardTitle className="text-sm font-semibold">Email steps</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {steps.map((st, i) => (
                  <div key={i} className="rounded-lg border border-border/50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-primary" /> Step {i + 1}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> after</span>
                        <Input type="number" value={st.delay_hours} onChange={(e) => setStep(i, { delay_hours: Number(e.target.value) || 0 })} className="h-6 w-16 text-xs" />
                        <span className="text-[10px] text-muted-foreground">h</span>
                        {steps.length > 1 && <button onClick={() => setSteps((s) => s.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                    </div>
                    <Input value={st.subject} onChange={(e) => setStep(i, { subject: e.target.value })} placeholder="Subject — {{first_name}} {{company}}" className="h-7 text-xs" />
                    <Textarea value={st.body} onChange={(e) => setStep(i, { body: e.target.value })} placeholder="Body / intent — Claude personalizes per lead." className="text-xs min-h-[64px]" />
                  </div>
                ))}
                <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => setSteps((s) => [...s, newStep(false)])}><Plus className="h-3.5 w-3.5" /> Add step</Button>
              </CardContent>
            </Card>

            {/* Send test */}
            <Card className="border-border/40">
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><Send className="h-4 w-4 text-primary" /> Send a test</CardTitle>
                <p className="text-xs text-muted-foreground">Emails every step (personalized against sample data) to these addresses, prefixed [TEST]. Requires a connected Gmail.</p>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                <Textarea value={testEmails} onChange={(e) => setTestEmails(e.target.value)} placeholder="test1@mago.studio, test2@mago.studio" className="text-xs min-h-[52px]" />
                <div className="flex justify-end">
                  <Button size="sm" className="h-8 text-xs gap-1.5" onClick={sendTest} disabled={testing || !testEmails.trim()}>
                    {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send test
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="border-t border-border/40 bg-background/80 backdrop-blur-md">
          <div className="mx-auto max-w-3xl w-full px-6 py-3 flex justify-between">
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/sequences")}>← Sequences</Button>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-9 text-xs gap-1.5" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
              </Button>
              <Button size="sm" className="h-9 text-xs gap-1.5" onClick={enrollAndRun} disabled={running}>
                {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Enroll ICP leads & run
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
