import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, MessageSquare } from "lucide-react";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";

export interface QueueItem {
  id: string;
  title: string;
  subtitle?: string;
  status: string;
  priority?: string;
  metadata?: Record<string, string>;
}

interface ActionQueueProps {
  items: QueueItem[];
  onApprove: (id: string) => void;
  onReject: (id: string, feedback?: string) => void;
  emptyMessage?: string;
}

const priorityColors: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20",
  low: "bg-muted text-muted-foreground border-border",
};

export function ActionQueue({ items, onApprove, onReject, emptyMessage = "No items" }: ActionQueueProps) {
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");

  const pendingItems = items.filter((i) => i.status === "pending");

  if (pendingItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Item</TableHead>
            <TableHead className="text-xs w-24">Priority</TableHead>
            <TableHead className="text-xs w-32 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pendingItems.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
                </div>
                {feedbackFor === item.id && (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="Why are you rejecting this?"
                      className="min-h-[60px] text-xs resize-none"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs"
                        onClick={() => {
                          onReject(item.id, feedbackText);
                          setFeedbackFor(null);
                          setFeedbackText("");
                        }}
                      >
                        Confirm Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => { setFeedbackFor(null); setFeedbackText(""); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </TableCell>
              <TableCell>
                {item.priority && (
                  <Badge variant="outline" className={`text-[10px] ${priorityColors[item.priority] || ""}`}>
                    {item.priority}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:text-primary" onClick={() => onApprove(item.id)}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setFeedbackFor(item.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
