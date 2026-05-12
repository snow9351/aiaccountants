import { useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Users, UserPlus, MessageSquare, Clock, CheckCircle, AlertCircle, Mail, Shield, Eye, Briefcase, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { useTeamMembers, useClientRequests, useInviteTeamMember, useCreateClientRequest, useUpdateClientRequest, usePendingInvitations } from "@/hooks/useAccountantPortal";
import { useCreateClientCompany, useEnsureMyAccountingFirm, useMyFirm } from "@/hooks/useFirm";
import { useOrgId, useCompanyStore } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { TeamMember, ClientRequest } from "@/hooks/useAccountantPortal";

const roleConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  owner:      { label: "Owner",      icon: Shield,    color: "bg-primary/10 text-primary border-primary/20" },
  accountant: { label: "Accountant", icon: Briefcase, color: "bg-success/10 text-success border-success/20" },
  bookkeeper: { label: "Bookkeeper", icon: Users,     color: "bg-warning/10 text-warning border-warning/20" },
  read_only:  { label: "Read Only",  icon: Eye,       color: "bg-muted text-muted-foreground border-border" },
};

const requestStatusConfig: Record<string, { label: string; color: string }> = {
  open:        { label: "Open",        color: "bg-destructive/10 text-destructive border-destructive/20" },
  in_progress: { label: "In Progress", color: "bg-warning/10 text-warning border-warning/20" },
  resolved:    { label: "Resolved",    color: "bg-success/10 text-success border-success/20" },
  closed:      { label: "Closed",      color: "bg-muted text-muted-foreground border-border" },
};

const priorityColors: Record<string, string> = {
  high: "text-destructive",
  medium: "text-warning",
  low: "text-muted-foreground",
};

export default function AccountantPortal() {
  const { toast } = useToast();
  const { user } = useAuth();
  const orgId = useOrgId();
  const { data: members = [] } = useTeamMembers(orgId);
  const otherMembers = members.filter((m) => m.user_id !== user?.id);
  const { data: pendingInvites = [] } = usePendingInvitations(orgId);
  const { data: requests = [] } = useClientRequests(orgId);
  const { data: firm, isPending: firmRowLoading } = useMyFirm();
  const ensureMyAccountingFirm = useEnsureMyAccountingFirm();
  const inviteMember = useInviteTeamMember();
  const createClientCompany = useCreateClientCompany();
  const createRequest = useCreateClientRequest();
  const updateRequest = useUpdateClientRequest();

  const [tab, setTab] = useState<"team" | "requests">("team");
  const [showInvite, setShowInvite] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [showRegisterFirm, setShowRegisterFirm] = useState(false);
  const [registerFirmForm, setRegisterFirmForm] = useState({ name: "", ein: "" });
  const [showRequest, setShowRequest] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "bookkeeper" as TeamMember['role'] });
  const [newClientForm, setNewClientForm] = useState({
    name: "",
    entity_type: "llc",
    accounting_method: "accrual",
    tax_id: "",
  });
  const [requestForm, setRequestForm] = useState({ title: "", description: "", priority: "medium" as ClientRequest['priority'], category: "question" as ClientRequest['category'] });

  const openRequests = requests.filter(r => r.status === "open" || r.status === "in_progress").length;

  const handleInvite = async () => {
    if (!orgId) {
      toast({ title: "Select a company first", description: "Create or select a company in Settings before inviting team members.", variant: "destructive" });
      return;
    }
    if (!inviteForm.email.trim()) {
      toast({ title: "Email required", variant: "destructive" }); return;
    }
    const flowAOwnerInvite = inviteForm.role === "owner";
    if (flowAOwnerInvite && !firm?.id) {
      toast({
        title: "Firm required",
        description: "Open Register my firm in the Accountant Portal (banner or New client company), then invite a business owner.",
        variant: "destructive",
      });
      return;
    }
    try {
      const row = await inviteMember.mutateAsync({
        org_id: orgId,
        email: inviteForm.email.trim(),
        role: inviteForm.role,
        firm_id: flowAOwnerInvite ? firm?.id ?? null : null,
      });
      const link = `${window.location.origin}/invite/${row.token}`;
      toast({
        title: "Invitation created",
        description: `Share this link with ${inviteForm.email}: ${link}`,
      });
      setShowInvite(false);
      setInviteForm({ email: "", role: "bookkeeper" });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleRegisterFirm = async () => {
    if (!registerFirmForm.name.trim()) {
      toast({ title: "Firm name required", variant: "destructive" });
      return;
    }
    try {
      await ensureMyAccountingFirm.mutateAsync({
        name: registerFirmForm.name.trim(),
        ein: registerFirmForm.ein.trim() || undefined,
      });
      toast({
        title: "Accounting firm registered",
        description: "You can create client companies under this firm.",
      });
      setShowRegisterFirm(false);
      setRegisterFirmForm({ name: "", ein: "" });
      setShowNewClient(true);
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleCreateClientCompany = async () => {
    if (!newClientForm.name.trim()) {
      toast({ title: "Company name required", variant: "destructive" });
      return;
    }
    try {
      const id = await createClientCompany.mutateAsync({
        name: newClientForm.name.trim(),
        entity_type: newClientForm.entity_type,
        accounting_method: newClientForm.accounting_method,
        tax_id: newClientForm.tax_id.trim() || undefined,
      });
      useCompanyStore.getState().setActiveOrgId(id);
      toast({ title: "Client company created", description: "You're now switched into this company's books." });
      setShowNewClient(false);
      setNewClientForm({ name: "", entity_type: "llc", accounting_method: "accrual", tax_id: "" });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleCreateRequest = async () => {
    if (!orgId) {
      toast({ title: "Select a company first", description: "Create or select a company in Settings before creating requests.", variant: "destructive" });
      return;
    }
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in again.", variant: "destructive" });
      return;
    }
    if (!requestForm.title) {
      toast({ title: "Title required", variant: "destructive" }); return;
    }
    try {
      await createRequest.mutateAsync({
        org_id: orgId,
        title: requestForm.title,
        description: requestForm.description,
        requested_by: user.id,
        requested_by_name: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "User",
        assigned_to: null,
        assigned_to_name: null,
        status: "open",
        priority: requestForm.priority,
        category: requestForm.category,
      });
      toast({ title: "Request created" });
      setShowRequest(false);
      setRequestForm({ title: "", description: "", priority: "medium", category: "question" });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const resolveRequest = (id: string) => {
    if (!orgId) {
      toast({ title: "Select a company first", variant: "destructive" });
      return;
    }
    updateRequest.mutate({ id, status: "resolved", resolved_at: new Date().toISOString() });
    toast({ title: "Request resolved" });
  };

  return (
    <AppLayout>
      <CommandPalette />

      {!firmRowLoading && !firm?.id && (
        <Alert className="mb-6 rounded-2xl border-primary/20 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertTitle>Register your accounting firm</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            <p className="mt-1">
              The <strong>New client company</strong> action creates a separate set of books for each client, linked to your firm.
              Google sign-in creates a default business workspace only; add a firm profile once here (or sign up with email as <strong>Accounting firm</strong> on{" "}
              <Link to="/login" className="font-medium text-primary underline underline-offset-2">Login</Link>
              ).
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" size="sm" className="rounded-xl" onClick={() => setShowRegisterFirm(true)}>
                Register my firm
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {!firmRowLoading && firm?.id && (
        <div className="mb-6 glass-card rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <Briefcase className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Your accounting firm</p>
                <p className="mt-1 font-display text-lg font-semibold text-foreground">{firm.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    <span className="font-medium text-foreground">Owner:</span>{" "}
                    {user?.email ?? "—"}
                  </span>
                  <span>
                    <span className="font-medium text-foreground">EIN:</span>{" "}
                    {firm.ein ? firm.ein : "—"}
                  </span>
                </div>
              </div>
            </div>
            <Button
              size="sm"
              className="rounded-xl"
              onClick={() => setShowNewClient(true)}
            >
              <Briefcase className="h-4 w-4" /> New client company
            </Button>
          </div>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Accountant Portal</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Client companies under your firm, team invites, and requests
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {tab === "team" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 rounded-xl"
                onClick={() => {
                  if (firmRowLoading) return;
                  if (!firm?.id) {
                    setShowRegisterFirm(true);
                    return;
                  }
                  setShowNewClient(true);
                }}
              >
                <Briefcase className="h-4 w-4" /> New client company
              </Button>
              <Button size="sm" className="gap-2 rounded-xl" onClick={() => setShowInvite(true)}>
                <UserPlus className="h-4 w-4" /> Invite
              </Button>
            </>
          )}
          {tab === "requests" && (
            <Button size="sm" className="gap-2 rounded-xl" onClick={() => setShowRequest(true)}>
              <MessageSquare className="h-4 w-4" /> New Request
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-muted/50 p-1 w-fit">
        <button
          onClick={() => setTab("team")}
          className={cn("rounded-lg px-4 py-2 text-sm font-medium transition-all", tab === "team" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          Team ({members.length})
        </button>
        <button
          onClick={() => setTab("requests")}
          className={cn("rounded-lg px-4 py-2 text-sm font-medium transition-all", tab === "requests" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          Requests {openRequests > 0 && <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">{openRequests}</span>}
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Team Members</p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">{otherMembers.filter(m => m.status === "active").length}</p>
          <p className="mt-1 text-xs text-muted-foreground">{members.filter(m => m.status === "invited").length} pending invites</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Open Requests</p>
          <p className="mt-1 font-display text-2xl font-bold text-warning">{openRequests}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Resolved This Month</p>
          <p className="mt-1 font-display text-2xl font-bold text-success">{requests.filter(r => r.status === "resolved").length}</p>
        </div>
      </div>

      {/* Team tab */}
      {tab === "team" && (
        <div className="space-y-3">
          {!orgId && (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="text-sm font-medium text-foreground">No company selected</p>
              <p className="mt-1 text-sm text-muted-foreground">Go to Settings and create/select a company to manage your team.</p>
            </div>
          )}
          {pendingInvites.length > 0 && (
            <div className="glass-card rounded-2xl p-5 border border-dashed border-border/60">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">Pending invitations</p>
              <ul className="space-y-2">
                {pendingInvites.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-foreground">{inv.email}</span>
                    <span className="text-xs text-muted-foreground capitalize">{inv.role.replace("_", " ")}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg text-xs"
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(`${window.location.origin}/invite/${inv.token}`);
                        toast({ title: "Link copied" });
                      }}
                    >
                      Copy link
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {otherMembers.map(member => {
            const role = roleConfig[member.role];
            const RoleIcon = role.icon;
            return (
              <div key={member.id} className="glass-card rounded-2xl p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {member.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{member.name}</span>
                        <span className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", role.color)}>
                          <RoleIcon className="h-2.5 w-2.5" /> {role.label}
                        </span>
                        {member.status === "invited" && (
                          <span className="flex items-center gap-1 rounded-full bg-warning/10 border border-warning/20 px-2 py-0.5 text-[10px] font-medium text-warning">
                            <Mail className="h-2.5 w-2.5" /> Invited
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {member.last_active_at ? (
                      <p className="text-[10px] text-muted-foreground">
                        Last active: {new Date(member.last_active_at).toLocaleDateString()}
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">Never signed in</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Requests tab */}
      {tab === "requests" && (
        <div className="space-y-3">
          {!orgId && (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="text-sm font-medium text-foreground">No company selected</p>
              <p className="mt-1 text-sm text-muted-foreground">Go to Settings and create/select a company to manage requests.</p>
            </div>
          )}
          {requests.map(req => {
            const status = requestStatusConfig[req.status];
            return (
              <div key={req.id} className="glass-card rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-medium", status.color)}>
                        {status.label}
                      </span>
                      <span className={cn("text-[10px] font-semibold uppercase", priorityColors[req.priority])}>
                        {req.priority}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground capitalize">
                        {req.category.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{req.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{req.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                      <span>From: {req.requested_by_name}</span>
                      {req.assigned_to_name && <span>Assigned: {req.assigned_to_name}</span>}
                      <span>{new Date(req.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {(req.status === "open" || req.status === "in_progress") && (
                    <Button variant="outline" size="sm" className="rounded-xl gap-1.5 border-border/50 shrink-0" onClick={() => resolveRequest(req.id)}>
                      <CheckCircle className="h-3.5 w-3.5" /> Resolve
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Invite dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/50 bg-card">
          <DialogHeader><DialogTitle className="font-display text-lg">Invite Team Member</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} placeholder="client@business.com" className="bg-background/50" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={inviteForm.role} onValueChange={(v: TeamMember['role']) => setInviteForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Business owner (claim this company)</SelectItem>
                  <SelectItem value="accountant">Accountant (full edit)</SelectItem>
                  <SelectItem value="bookkeeper">Bookkeeper</SelectItem>
                  <SelectItem value="read_only">Read only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-xl border border-border/30 bg-secondary/20 p-3">
              <p className="text-xs text-muted-foreground">
                We generate a secure link you can share (copy from the confirmation). Email delivery can be wired separately.
                Expires in 7 days.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowInvite(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl" onClick={handleInvite} disabled={inviteMember.isPending}>
                {inviteMember.isPending ? "Sending..." : "Send Invite"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Register accounting firm (e.g. after Google signup) */}
      <Dialog
        open={showRegisterFirm}
        onOpenChange={(open) => {
          setShowRegisterFirm(open);
          if (!open) setRegisterFirmForm({ name: "", ein: "" });
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl border-border/50 bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Register accounting firm</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              This links client companies to your practice. Your existing workspace is unchanged.
            </p>
            <div className="space-y-1.5">
              <Label>Firm name *</Label>
              <Input
                value={registerFirmForm.name}
                onChange={(e) => setRegisterFirmForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Smith & Associates CPA"
                className="bg-background/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Firm EIN / Tax ID (optional)</Label>
              <Input
                value={registerFirmForm.ein}
                onChange={(e) => setRegisterFirmForm((f) => ({ ...f, ein: e.target.value }))}
                placeholder="12-3456789"
                className="bg-background/50"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowRegisterFirm(false)}>
                Cancel
              </Button>
              <Button className="flex-1 rounded-xl" onClick={() => void handleRegisterFirm()} disabled={ensureMyAccountingFirm.isPending}>
                {ensureMyAccountingFirm.isPending ? "Saving…" : "Save & continue"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New client company (Flow A) */}
      <Dialog open={showNewClient} onOpenChange={setShowNewClient}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/50 bg-card">
          <DialogHeader><DialogTitle className="font-display text-lg">New client company</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Company legal name *</Label>
              <Input
                value={newClientForm.name}
                onChange={(e) => setNewClientForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Acme Holdings LLC"
                className="bg-background/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Entity</Label>
                <Select value={newClientForm.entity_type} onValueChange={(v) => setNewClientForm((f) => ({ ...f, entity_type: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="llc">LLC</SelectItem>
                    <SelectItem value="s_corp">S Corp</SelectItem>
                    <SelectItem value="c_corp">C Corp</SelectItem>
                    <SelectItem value="sole_prop">Sole prop</SelectItem>
                    <SelectItem value="partnership">Partnership</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Books</Label>
                <Select value={newClientForm.accounting_method} onValueChange={(v) => setNewClientForm((f) => ({ ...f, accounting_method: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="accrual">Accrual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>EIN / Tax ID (optional)</Label>
              <Input
                value={newClientForm.tax_id}
                onChange={(e) => setNewClientForm((f) => ({ ...f, tax_id: e.target.value }))}
                placeholder="12-3456789"
                className="bg-background/50"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowNewClient(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl" onClick={() => void handleCreateClientCompany()} disabled={createClientCompany.isPending}>
                {createClientCompany.isPending ? "Creating…" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New request dialog */}
      <Dialog open={showRequest} onOpenChange={setShowRequest}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border/50 bg-card">
          <DialogHeader><DialogTitle className="font-display text-lg">New Request</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={requestForm.title} onChange={e => setRequestForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Q1 tax documents needed" className="bg-background/50" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={requestForm.description} onChange={e => setRequestForm(f => ({ ...f, description: e.target.value }))} placeholder="Provide details..." className="bg-background/50 resize-none" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={requestForm.priority} onValueChange={(v: ClientRequest['priority']) => setRequestForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={requestForm.category} onValueChange={(v: ClientRequest['category']) => setRequestForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="question">Question</SelectItem>
                    <SelectItem value="document_request">Document Request</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="adjustment">Adjustment</SelectItem>
                    <SelectItem value="tax">Tax</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowRequest(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl" onClick={handleCreateRequest} disabled={createRequest.isPending}>
                {createRequest.isPending ? "Creating..." : "Create Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
