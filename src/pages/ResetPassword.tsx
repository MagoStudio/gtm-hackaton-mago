import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // The recovery link drops a temporary session (via the URL hash). Wait for it.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setHasSession(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setHasSession(true);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast({ title: 'Too short', description: 'Password must be at least 6 characters.', variant: 'destructive' }); return; }
    if (password !== confirm) { toast({ title: "Passwords don't match", variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: 'Password updated', description: 'You can now use your new password.' });
      navigate('/', { replace: true });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 bg-card shadow-2xl shadow-primary/5">
        <CardHeader className="space-y-2 text-center">
          <img src="/images/mago-logo-app-on-blue.svg" alt="Mago" className="mx-auto mb-2 h-12 w-12 rounded-xl" />
          <CardTitle className="text-2xl font-bold tracking-tight">Set a new password</CardTitle>
          <CardDescription className="text-muted-foreground">Choose a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : !hasSession ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">This reset link is invalid or has expired.</p>
              <Button variant="outline" className="w-full" onClick={() => navigate('/auth')}>Back to sign in</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="bg-secondary/50" autoFocus />
              <Input type="password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} className="bg-secondary/50" />
              <Button type="submit" className="w-full font-semibold" disabled={submitting}>
                {submitting ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
