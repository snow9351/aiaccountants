import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CommandPalette } from "@/components/CommandPalette";
import { useEmployees, useCreateEmployee, usePayrollRuns, useRunPayroll } from "@/hooks/usePayroll";
import { useOrgId } from "@/hooks/useCompanies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  Calendar,
  DollarSign,
  Play,
  Plus,
  Users,
} from "lucide-react";

/* ---------- helpers ---------- */

function fmt(n: number | null | undefined) {
  if (n == null) return "$0";
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "--";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const employeeStatusColor: Record<string, string> = {
  active: "bg-success/15 text-success border-success/30",
  inactive: "bg-muted/50 text-muted-foreground border-muted",
  on_leave: "bg-warning/15 text-warning border-warning/30",
  terminated: "bg-destructive/15 text-destructive border-destructive/30",
};

const runStatusColor: Record<string, string> = {
  draft: "bg-muted/50 text-muted-foreground border-muted",
  processing: "bg-warning/15 text-warning border-warning/30",
  completed: "bg-success/15 text-success border-success/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
};

const employmentTypeLabel: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contractor: "Contractor",
};

/* ---------- component ---------- */

export default function Payroll() {
  const orgId = useOrgId();
  const { data: employees = [], isLoading: loadingEmployees } = useEmployees();
  const { data: payrollRuns = [], isLoading: loadingRuns } = usePayrollRuns();
  const createEmployee = useCreateEmployee();
  const runPayroll = useRunPayroll();

  const [addOpen, setAddOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);

  /* Add Employee form state */
  const [empForm, setEmpForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    job_title: "",
    department: "",
    salary: "",
    employment_type: "full_time" as "full_time" | "part_time" | "contractor",
  });

  /* Run Payroll form state */
  const [runForm, setRunForm] = useState({
    pay_period_start: "",
    pay_period_end: "",
    payroll_date: "",
  });

  /* derived stats */
  const activeEmployees = employees.filter((e) => e.status === "active");
  const totalEmployees = employees.length;
  const activeCount = activeEmployees.length;
  const avgSalary =
    activeEmployees.length > 0
      ? activeEmployees.reduce((sum, e) => sum + (e.salary ?? 0), 0) / activeEmployees.length
      : 0;

  /* handlers */
  function handleAddEmployee() {
    createEmployee.mutate(
      {
        org_id: orgId,
        first_name: empForm.first_name,
        last_name: empForm.last_name,
        email: empForm.email || null,
        job_title: empForm.job_title || null,
        department: empForm.department || null,
        salary: empForm.salary ? Number(empForm.salary) : null,
        employment_type: empForm.employment_type,
        hire_date: new Date().toISOString().slice(0, 10),
        status: "active",
        salary_frequency: "annual",
        overtime_multiplier: 1.5,
      },
      {
        onSuccess: () => {
          setAddOpen(false);
          setEmpForm({
            first_name: "",
            last_name: "",
            email: "",
            job_title: "",
            department: "",
            salary: "",
            employment_type: "full_time",
          });
        },
      },
    );
  }

  function handleRunPayroll() {
    runPayroll.mutate(
      {
        pay_period_start: runForm.pay_period_start,
        pay_period_end: runForm.pay_period_end,
        payroll_date: runForm.payroll_date,
        org_id: orgId,
      },
      {
        onSuccess: () => {
          setRunOpen(false);
          setRunForm({ pay_period_start: "", pay_period_end: "", payroll_date: "" });
        },
      },
    );
  }

  return (
    <AppLayout>
      <CommandPalette />

      {/* ---------- header ---------- */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Payroll</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage employees and run payroll
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl border-border/50"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" /> Add Employee
          </Button>
          <Button
            size="sm"
            className="gap-2 rounded-xl glow-primary"
            onClick={() => setRunOpen(true)}
          >
            <Play className="h-4 w-4" /> Run Payroll
          </Button>
        </div>
      </div>

      {/* ---------- tabs ---------- */}
      <Tabs defaultValue="employees" className="space-y-6">
        <TabsList className="rounded-xl">
          <TabsTrigger value="employees" className="gap-2 rounded-xl">
            <Users className="h-4 w-4" /> Employees
          </TabsTrigger>
          <TabsTrigger value="runs" className="gap-2 rounded-xl">
            <Calendar className="h-4 w-4" /> Payroll Runs
          </TabsTrigger>
        </TabsList>

        {/* ======================== EMPLOYEES TAB ======================== */}
        <TabsContent value="employees" className="space-y-6">
          {/* stats row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Total Employees
                  </p>
                  <p className="font-display text-2xl font-bold text-foreground">
                    {totalEmployees}
                  </p>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
                  <Briefcase className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Active
                  </p>
                  <p className="font-display text-2xl font-bold text-success">{activeCount}</p>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
                  <DollarSign className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Avg Salary
                  </p>
                  <p className="font-display text-2xl font-bold text-foreground">{fmt(avgSalary)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* employee cards */}
          {loadingEmployees ? (
            <div className="glass-card rounded-2xl p-10 text-center text-sm text-muted-foreground">
              Loading employees...
            </div>
          ) : employees.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center">
              <p className="text-sm text-muted-foreground">
                No employees yet. Click "Add Employee" to get started.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {employees.map((emp) => (
                <div
                  key={emp.id}
                  className="glass-card rounded-2xl p-5 transition-colors hover:bg-secondary/30"
                >
                  {/* top row: avatar + name */}
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-display text-sm font-bold text-primary">
                        {emp.first_name?.[0]}
                        {emp.last_name?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {emp.first_name} {emp.last_name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {emp.job_title || "No title"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        employeeStatusColor[emp.status] ?? employeeStatusColor.inactive,
                      )}
                    >
                      {emp.status.replace("_", " ")}
                    </span>
                  </div>

                  {/* details */}
                  <div className="space-y-2 text-xs text-muted-foreground">
                    {emp.department && (
                      <div className="flex items-center justify-between">
                        <span>Department</span>
                        <span className="font-medium text-foreground">{emp.department}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span>Salary</span>
                      <span className="font-semibold text-foreground">
                        {fmt(emp.salary)}
                        <span className="ml-0.5 font-normal text-muted-foreground">
                          /{emp.salary_frequency === "annual" ? "yr" : emp.salary_frequency}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Type</span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          emp.employment_type === "contractor"
                            ? "border-warning/30 bg-warning/10 text-warning"
                            : "border-primary/30 bg-primary/10 text-primary",
                        )}
                      >
                        {employmentTypeLabel[emp.employment_type] ?? emp.employment_type}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Hired</span>
                      <span className="font-medium text-foreground">{fmtDate(emp.hire_date)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ======================== PAYROLL RUNS TAB ======================== */}
        <TabsContent value="runs" className="space-y-6">
          {loadingRuns ? (
            <div className="glass-card rounded-2xl p-10 text-center text-sm text-muted-foreground">
              Loading payroll runs...
            </div>
          ) : payrollRuns.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center">
              <p className="text-sm text-muted-foreground">
                No payroll runs yet. Click "Run Payroll" to process your first run.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {payrollRuns.map((run) => (
                <div
                  key={run.id}
                  className="glass-card rounded-2xl p-5 transition-colors hover:bg-secondary/30"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    {/* left: status + period */}
                    <div className="flex items-center gap-4">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          runStatusColor[run.status] ?? runStatusColor.draft,
                        )}
                      >
                        {run.status}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {fmtDate(run.pay_period_start)} &ndash; {fmtDate(run.pay_period_end)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Payroll date: {fmtDate(run.payroll_date)}
                        </p>
                      </div>
                    </div>

                    {/* right: totals */}
                    <div className="flex items-center gap-6 text-xs">
                      <div className="text-right">
                        <p className="text-muted-foreground">Gross</p>
                        <p className="font-display text-sm font-bold text-foreground">
                          {fmt(run.total_gross)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">Taxes</p>
                        <p className="font-display text-sm font-bold text-warning">
                          {fmt(run.total_taxes)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">Net</p>
                        <p className="font-display text-sm font-bold text-primary">
                          {fmt(run.total_net)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">Employees</p>
                        <p className="font-display text-sm font-bold text-foreground">
                          {run.employee_count}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ======================== ADD EMPLOYEE DIALOG ======================== */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="glass-card rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">Add Employee</DialogTitle>
            <DialogDescription>
              Enter the new employee's details below.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  placeholder="Jane"
                  className="rounded-xl"
                  value={empForm.first_name}
                  onChange={(e) => setEmpForm((p) => ({ ...p, first_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  placeholder="Doe"
                  className="rounded-xl"
                  value={empForm.last_name}
                  onChange={(e) => setEmpForm((p) => ({ ...p, last_name: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="jane@company.com"
                className="rounded-xl"
                value={empForm.email}
                onChange={(e) => setEmpForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="job_title">Job Title</Label>
                <Input
                  id="job_title"
                  placeholder="Software Engineer"
                  className="rounded-xl"
                  value={empForm.job_title}
                  onChange={(e) => setEmpForm((p) => ({ ...p, job_title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  placeholder="Engineering"
                  className="rounded-xl"
                  value={empForm.department}
                  onChange={(e) => setEmpForm((p) => ({ ...p, department: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="salary">Salary (Annual)</Label>
                <Input
                  id="salary"
                  type="number"
                  placeholder="100000"
                  className="rounded-xl"
                  value={empForm.salary}
                  onChange={(e) => setEmpForm((p) => ({ ...p, salary: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Employment Type</Label>
                <Select
                  value={empForm.employment_type}
                  onValueChange={(v) =>
                    setEmpForm((p) => ({
                      ...p,
                      employment_type: v as "full_time" | "part_time" | "contractor",
                    }))
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full-time</SelectItem>
                    <SelectItem value="part_time">Part-time</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl glow-primary"
              disabled={!empForm.first_name || !empForm.last_name || createEmployee.isPending}
              onClick={handleAddEmployee}
            >
              {createEmployee.isPending ? "Adding..." : "Add Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================== RUN PAYROLL DIALOG ======================== */}
      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="glass-card rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">Run Payroll</DialogTitle>
            <DialogDescription>
              Define the pay period and payroll date to process.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="period_start">Period Start</Label>
              <Input
                id="period_start"
                type="date"
                className="rounded-xl"
                value={runForm.pay_period_start}
                onChange={(e) => setRunForm((p) => ({ ...p, pay_period_start: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period_end">Period End</Label>
              <Input
                id="period_end"
                type="date"
                className="rounded-xl"
                value={runForm.pay_period_end}
                onChange={(e) => setRunForm((p) => ({ ...p, pay_period_end: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payroll_date">Payroll Date</Label>
              <Input
                id="payroll_date"
                type="date"
                className="rounded-xl"
                value={runForm.payroll_date}
                onChange={(e) => setRunForm((p) => ({ ...p, payroll_date: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setRunOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl glow-primary"
              disabled={
                !runForm.pay_period_start ||
                !runForm.pay_period_end ||
                !runForm.payroll_date ||
                runPayroll.isPending
              }
              onClick={handleRunPayroll}
            >
              {runPayroll.isPending ? "Processing..." : "Run Payroll"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
