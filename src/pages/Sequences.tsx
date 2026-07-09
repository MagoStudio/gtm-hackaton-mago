import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { Workflow } from "lucide-react";

export default function Sequences() {
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
    <AppLayout>
      <div className="mx-auto max-w-5xl w-full px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <Workflow className="h-6 w-6 text-primary" />
            Sequences
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Define per-tier outreach sequences — steps, delays, and channels.
          </p>
        </div>

        <div className="rounded-xl border border-dashed border-border/60 py-24 text-center">
          <Workflow className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Sequence builder coming soon.</p>
        </div>
      </div>
    </AppLayout>
  );
}
