import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { isSupabaseConfigured } from '@/integrations/supabase/client';

export default function Login() {
  const navigate = useNavigate();
  const { signIn, signUp, signInWithGoogle, resetPassword, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured && mode !== 'reset') {
      // Demo mode: sign in with mock user
      await signIn(email, password);
      navigate('/dashboard');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'reset') {
        await resetPassword(email);
        toast({ title: 'Reset email sent', description: 'Check your inbox for a password reset link.' });
        setMode('signin');
      } else if (mode === 'signin') {
        await signIn(email, password);
        navigate('/dashboard');
      } else {
        await signUp(email, password, name);
        toast({ title: 'Account created!', description: 'Your workspace is ready.' });
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      toast({
        title: 'Authentication failed',
        description: (err as Error)?.message ?? 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDemoMode = async () => {
    await signIn('demo@example.com', 'demo');
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 bg-mesh">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 glow-primary mb-4">
            <Zap className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold text-gradient">AI Accountants</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            AI-native accounting for modern businesses
          </p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-3xl p-8">
          <h2 className="text-xl font-semibold mb-1">
            {mode === 'reset' ? 'Reset password' : mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === 'reset'
              ? 'Enter your email to receive a reset link'
              : mode === 'signin'
              ? 'Sign in to access your financial dashboard'
              : 'Get started with AI-powered accounting'}
          </p>

          {/* Google OAuth */}
          {mode !== 'reset' && isSupabaseConfigured && (
            <>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={async () => {
                  try { await signInWithGoogle(); } catch (err) {
                    toast({ title: 'Google sign-in failed', description: (err as Error)?.message, variant: 'destructive' });
                  }
                }}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </Button>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="Jordan Davis"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="pl-10 bg-background/50"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="pl-10 bg-background/50"
                  required
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => setMode('reset')}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-background/50"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={loading}
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
              ) : (
                <>
                  {mode === 'reset' ? 'Send reset link' : mode === 'signin' ? 'Sign in' : 'Create account'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {!isSupabaseConfigured && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full gap-2 border-primary/30 hover:bg-primary/10 hover:border-primary/60"
                onClick={handleDemoMode}
              >
                <Zap className="h-4 w-4 text-primary" />
                Continue as Demo (no login required)
              </Button>
            </>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === 'reset' ? (
              <>
                Remember your password?{' '}
                <button type="button" onClick={() => setMode('signin')} className="text-primary hover:underline font-medium">
                  Sign in
                </button>
              </>
            ) : mode === 'signin' ? (
              <>
                Don't have an account?{' '}
                <button type="button" onClick={() => setMode('signup')} className="text-primary hover:underline font-medium">
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" onClick={() => setMode('signin')} className="text-primary hover:underline font-medium">
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Your financial data is encrypted and secure
        </p>
      </div>
    </div>
  );
}
