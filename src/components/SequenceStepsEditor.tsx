import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Mail, Trash2, Plus, Clock, Zap } from "lucide-react";

// delay_hours is what the sequencer reads; delay_value/unit are the UI-friendly
// representation. Recomputed on every edit so they stay in sync.
export type DelayUnit = "minutes" | "hours" | "days";

export interface Step {
  channel: "email";
  delay_value: number;
  delay_unit: DelayUnit;
  delay_hours: number;
  subject: string;
  body: string;
}

const toHours = (value: number, unit: DelayUnit): number =>
  unit === "days" ? value * 24 : unit === "minutes" ? value / 60 : value;

export const newStep = (first: boolean): Step =>
  first
    ? { channel: "email", delay_value: 0, delay_unit: "hours", delay_hours: 0, subject: "", body: "" }
    : { channel: "email", delay_value: 2, delay_unit: "days", delay_hours: 48, subject: "", body: "" };

// Accept steps saved in any shape (older ones only have delay_hours) and
// normalize to the {value, unit, hours} form.
export function normalizeSteps(raw: any[]): Step[] {
  const steps = (raw || []).map((s, i) => {
    const hours = typeof s.delay_hours === "number" ? s.delay_hours : 0;
    let unit: DelayUnit =
      s.delay_unit === "days" || s.delay_unit === "hours" || s.delay_unit === "minutes"
        ? s.delay_unit
        : hours > 0 && hours < 1 ? "minutes"
        : hours > 0 && hours % 24 === 0 ? "days"
        : "hours";
    let value = typeof s.delay_value === "number"
      ? s.delay_value
      : unit === "days" ? Math.round(hours / 24) : unit === "minutes" ? Math.round(hours * 60) : hours;
    if (i === 0) { value = 0; unit = "hours"; }
    return { channel: "email" as const, delay_value: value, delay_unit: unit, delay_hours: i === 0 ? 0 : toHours(value, unit), subject: s.subject || "", body: s.body || "" };
  });
  return steps.length ? steps : [newStep(true)];
}

const recompute = (s: Step): Step => ({ ...s, delay_hours: toHours(s.delay_value, s.delay_unit) });

export function SequenceStepsEditor({ steps, onChange }: { steps: Step[]; onChange: (s: Step[]) => void }) {
  const setStep = (i: number, patch: Partial<Step>) =>
    onChange(steps.map((st, idx) => (idx === i ? recompute({ ...st, ...patch }) : st)));
  const removeStep = (i: number) => onChange(steps.filter((_, idx) => idx !== i));
  const addStep = () => onChange([...steps, newStep(false)]);

  return (
    <div className="space-y-0">
      {steps.map((st, i) => (
        <div key={i}>
          {/* Intermediary wait block — between the previous step and this one */}
          {i === 0 ? (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground pl-1 pb-2">
              <Zap className="h-3.5 w-3.5 text-primary" /> Sends immediately when a lead is enrolled
            </div>
          ) : (
            <div className="flex flex-col items-center py-1">
              <div className="h-3 w-px bg-border" />
              <div className="flex items-center gap-2 rounded-full border border-border/60 bg-secondary/40 px-3 py-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Wait</span>
                <Input
                  type="number" min={0} value={st.delay_value}
                  onChange={(e) => setStep(i, { delay_value: Math.max(0, Number(e.target.value) || 0) })}
                  className="h-6 w-14 text-xs text-center px-1"
                />
                <select
                  value={st.delay_unit}
                  onChange={(e) => setStep(i, { delay_unit: e.target.value as DelayUnit })}
                  className="h-6 text-xs rounded-md border border-border/60 bg-background px-1"
                >
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                  <option value="days">days</option>
                </select>
              </div>
              <div className="h-3 w-px bg-border" />
            </div>
          )}

          {/* Step block */}
          <div className="rounded-lg border border-border/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-primary" /> Step {i + 1} · email
              </span>
              {steps.length > 1 && (
                <button onClick={() => removeStep(i)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Input
              value={st.subject} onChange={(e) => setStep(i, { subject: e.target.value })}
              placeholder="Subject — supports {{first_name}} {{company}}" className="h-7 text-xs"
            />
            <Textarea
              value={st.body} onChange={(e) => setStep(i, { body: e.target.value })}
              placeholder="Body / intent. Claude personalizes this per lead. Use {{first_name}}, {{company}}, {{job_title}}."
              className="text-xs min-h-[64px]"
            />
          </div>
        </div>
      ))}

      <div className="pt-3">
        <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={addStep}>
          <Plus className="h-3.5 w-3.5" /> Add step
        </Button>
      </div>
    </div>
  );
}
