import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Zap, Mail, Lock, User, ArrowRight, Eye, EyeOff, Building2, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useAuth, setPendingInviteToken } from '@/contexts/AuthContext';
import { isSupabaseConfigured } from '@/integrations/supabase/client';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const { signIn, signUp, signInWithGoogle, resetPassword, isAuthenticated, user, signOut } = useAuth();
  const { toast } = useToast();

  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [signupAs, setSignupAs] = useState<'business' | 'accountant'>('business');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [firmName, setFirmName] = useState('');
  const [firmEin, setFirmEin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (inviteToken) setPendingInviteToken(inviteToken);
  }, [inviteToken]);

  useEffect(() => {
    const m = searchParams.get('mode');
    if (m === 'signup') setMode('signup');
  }, [searchParams]);

  /** While a Supabase session exists, lock email/password until user signs out (no silent skip of credentials). */
  const sessionLocksCredentials = isAuthenticated && mode !== 'reset';

  const navigateAfterAuth = () => {
    if (inviteToken) navigate(`/invite/${inviteToken}`, { replace: true });
    else navigate('/dashboard', { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured && mode !== 'reset') {
      await signIn(email, password);
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
        navigateAfterAuth();
      } else {
        if (inviteToken) {
          await signUp(email, password, name, { skipDefaultWorkspace: true });
          toast({
            title: 'Account created',
            description: 'Finish accepting your invitation on the next screen.',
          });
        } else if (signupAs === 'accountant') {
          if (!firmName.trim()) {
            toast({ title: 'Firm name required', variant: 'destructive' });
            setLoading(false);
            return;
          }
          await signUp(email, password, name, {
            onboarding: 'accountant',
            firmName: firmName.trim(),
            firmEin: firmEin.trim() || undefined,
          });
          toast({
            title: 'Welcome',
            description: 'Create a client company from the Accountant Portal when you are ready.',
          });
        } else {
          await signUp(email, password, name);
          toast({ title: 'Account created!', description: 'Your workspace is ready.' });
        }
        navigateAfterAuth();
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
    await signIn(email, password);
  };

  const showSignupPaths = mode === 'signup' && !inviteToken && isSupabaseConfigured;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 bg-mesh">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 glow-primary mb-4">
            <Zap className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold text-gradient">AI Accountants</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            AI-native accounting for modern businesses
          </p>
        </div>

        <div className="glass-card rounded-3xl p-8">
          <h2 className="text-xl font-semibold mb-1">
            {mode === 'reset' ? 'Reset password' : mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === 'reset'
              ? 'Enter your email to receive a reset link'
              : mode === 'signin'
              ? 'Sign in to access your financial dashboard'
              : inviteToken
              ? 'Create your login—we will link the invited company next.'
              : 'Choose how you will use the product, then continue with email or Google.'}
          </p>

          {isAuthenticated && user && (
            <div className="mb-6 rounded-2xl border border-border/60 bg-muted/30 p-4">
              <p className="text-sm text-foreground">
                Active session as <span className="font-medium">{user.email}</span>.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                To sign in with email and password again on this device, sign out first. We never skip the password step after logout.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="rounded-xl"
                  onClick={() =>
                    navigate(inviteToken ? `/invite/${inviteToken}` : '/dashboard', { replace: true })
                  }
                >
                  Continue to app
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-xl"
                  onClick={async () => {
                    await signOut();
                    toast({ title: 'Signed out', description: 'Enter your email and password below.' });
                  }}
                >
                  Sign out
                </Button>
              </div>
            </div>
          )}

          {mode !== 'reset' && isSupabaseConfigured && (
            <>
              <Button
                variant="outline"
                className="w-full gap-2"
                type="button"
                disabled={sessionLocksCredentials}
                onClick={async () => {
                  try {
                    await signInWithGoogle();
                  } catch (err) {
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
              <p className="mt-2 text-xs text-muted-foreground text-center">
                Google creates a default company workspace. To register as an accounting firm without that flow, use email signup and select{" "}
                <span className="font-medium">Accounting firm</span>. If you already use Google, open{" "}
                <span className="font-medium">Accountant Portal</span> and use <span className="font-medium">Register my firm</span> there.
              </p>
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

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
            autoComplete={mode === 'signin' ? 'off' : 'on'}
          >
            {showSignupPaths && (
              <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">I am signing up as</Label>
                <RadioGroup
                  value={signupAs}
                  onValueChange={(v) => setSignupAs(v as 'business' | 'accountant')}
                  className="grid gap-2"
                  disabled={sessionLocksCredentials}
                >
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/50 bg-background/50 p-3 has-[[data-state=checked]]:border-primary/40">
                    <RadioGroupItem value="business" id="su-business" className="mt-1" />
                    <div>
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Building2 className="h-4 w-4 text-primary" /> Business owner
                      </span>
                      <p className="mt-1 text-xs text-muted-foreground">Run your own books; invite an accountant later.</p>
                    </div>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/50 bg-background/50 p-3 has-[[data-state=checked]]:border-primary/40">
                    <RadioGroupItem value="accountant" id="su-accountant" className="mt-1" />
                    <div>
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Briefcase className="h-4 w-4 text-primary" /> Accounting firm
                      </span>
                      <p className="mt-1 text-xs text-muted-foreground">Manage client companies under your firm.</p>
                    </div>
                  </label>
                </RadioGroup>
                {signupAs === 'accountant' && (
                  <div className="grid gap-3 pt-1">
                    <div className="space-y-1.5">
                      <Label htmlFor="firm-name">Firm name</Label>
                      <Input
                        id="firm-name"
                        value={firmName}
                        onChange={(e) => setFirmName(e.target.value)}
                        placeholder="North Star CPA LLC"
                        className="bg-background/50"
                        disabled={sessionLocksCredentials}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="firm-ein">Firm EIN / Tax ID (optional)</Label>
                      <Input
                        id="firm-ein"
                        value={firmEin}
                        onChange={(e) => setFirmEin(e.target.value)}
                        placeholder="12-3456789"
                        className="bg-background/50"
                        disabled={sessionLocksCredentials}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {mode === 'signup' && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="Jordan Davis"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 bg-background/50"
                    required
                    disabled={sessionLocksCredentials}
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
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-background/50"
                    required
                    disabled={sessionLocksCredentials}
                    autoComplete={mode === 'signin' ? 'username' : 'email'}
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
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-background/50"
                    required
                    minLength={6}
                    disabled={sessionLocksCredentials}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full gap-2" disabled={loading || sessionLocksCredentials}>
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
                type="button"
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
