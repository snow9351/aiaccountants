import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Zap, Building2, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth, setPendingInviteToken } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef, useState } from "react";

type PeekResult = {
  company_name: string | null;
  role: string | null;
  expires_at: string | null;
} | null;

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const autoAcceptStarted = useRef(false);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState(false);

  useEffect(() => {
    if (token) setPendingInviteToken(token);
  }, [token]);

  const { data: preview, isLoading: previewLoading, isError } = useQuery({
    queryKey: ["peek_invitation", token],
    queryFn: async (): Promise<PeekResult> => {
      if (!isSupabaseConfigured || !token) return null;
      const { data, error } = await supabase.rpc("peek_invitation", { p_token: token });
      if (error) throw error;
      return data as PeekResult;
    },
    enabled: !!token && isSupabaseConfigured,
  });

  const runAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setAcceptError(false);
    try {
      const { error } = await supabase.rpc("accept_invitation", { p_token: token });
      if (error) throw error;
      setPendingInviteToken(null);
      await qc.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "You're in", description: "The invitation was accepted." });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setAcceptError(true);
      autoAcceptStarted.current = false;
      toast({
        title: "Could not accept invite",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  };

  useEffect(() => {
    if (
      loading ||
      !user ||
      !token ||
      previewLoading ||
      !preview?.company_name ||
      autoAcceptStarted.current ||
      accepting
    ) {
      return;
    }
    autoAcceptStarted.current = true;
    void runAccept();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot accept when session + preview ready
  }, [loading, user?.id, token, previewLoading, preview?.company_name]);

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground">Invalid invite link.</p>
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground">Supabase is not configured.</p>
      </div>
    );
  }

  if (previewLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading invitation…</p>
      </div>
    );
  }

  if (isError || !preview?.company_name) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center p-4">
        <div className="glass-card max-w-md rounded-3xl p-8 text-center">
          <p className="font-medium text-foreground">This invitation is invalid or expired.</p>
          <p className="mt-2 text-sm text-muted-foreground">Ask your administrator for a new invite link.</p>
          <Button className="mt-6 rounded-xl" variant="outline" asChild>
            <Link to="/login">Go to sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-card rounded-3xl p-8">
        <div className="text-center mb-6">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <Zap className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">You're invited</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Join <span className="font-medium text-foreground">{preview.company_name}</span>
            {preview.role ? (
              <span> as {preview.role.replace("_", " ")}</span>
            ) : null}
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-2xl bg-muted/40 p-4 mb-6">
          <Building2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            After you sign in, we finish linking this workspace. If you are new, choose{" "}
            <span className="font-medium text-foreground">Create account</span> so we skip creating an extra empty
            company before you accept this invite.
          </p>
        </div>

        {user && accepting && (
          <div className="flex flex-col items-center gap-2 py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Accepting invitation…</p>
          </div>
        )}

        {!user && (
          <div className="space-y-3">
            <Button className="w-full rounded-xl gap-2" asChild>
              <Link to={`/login?invite=${encodeURIComponent(token)}`}>
                Sign in to accept <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" className="w-full rounded-xl gap-2" asChild>
              <Link to={`/login?invite=${encodeURIComponent(token)}&mode=signup`}>
                Create account & accept
              </Link>
            </Button>
          </div>
        )}

        {user && acceptError && (
          <Button className="w-full rounded-xl" disabled={accepting} onClick={() => void runAccept()}>
            Try again
          </Button>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Invitation expires {preview.expires_at ? new Date(preview.expires_at).toLocaleString() : "soon"}.
        </p>
      </div>
    </div>
  );
}
