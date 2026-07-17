import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, isAllowedEmail, ALLOWED_EMAIL_DOMAIN } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const { user, loading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleForgotPassword = async () => {
    if (!isAllowedEmail(email)) {
      toast({ title: 'Enter your email', description: `Type your @${ALLOWED_EMAIL_DOMAIN} email above, then click "Forgot password".`, variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: 'Check your email', description: 'We sent a password reset link.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAllowedEmail(email)) {
      toast({ title: 'Restricted', description: `Only @${ALLOWED_EMAIL_DOMAIN} email addresses can access this app.`, variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast({ title: 'Check your email', description: 'We sent you a confirmation link.' });
      }
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
          <img
            src="/images/mago-logo-app-on-blue.svg"
            alt="Mago"
            className="mx-auto mb-2 h-12 w-12 rounded-xl"
          />
          <CardTitle className="text-2xl font-bold tracking-tight">Mago Growth OS</CardTitle>
          <CardDescription className="text-muted-foreground">
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-secondary/50"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="bg-secondary/50"
            />
            <Button type="submit" className="w-full font-semibold" disabled={submitting}>
              {submitting ? 'Loading…' : isLogin ? 'Sign In' : 'Sign Up'}
            </Button>
          </form>
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="mt-4 w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
          {isLogin && (
            <button
              onClick={handleForgotPassword}
              disabled={submitting}
              className="mt-2 w-full text-center text-xs text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              Forgot password?
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
