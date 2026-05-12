import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { type ReactNode, useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import LandingPage from "./pages/LandingPage.tsx";
import Login from "./pages/Login.tsx";
import AcceptInvite from "./pages/AcceptInvite.tsx";
import Index from "./pages/Index.tsx";
import Transactions from "./pages/Transactions.tsx";
import Invoices from "./pages/Invoices.tsx";
import Expenses from "./pages/Expenses.tsx";
import Reports from "./pages/Reports.tsx";
import Customers from "./pages/Customers.tsx";
import Banking from "./pages/Banking.tsx";
import Payroll from "./pages/Payroll.tsx";
import Insights from "./pages/Insights.tsx";
import AuditLog from "./pages/AuditLog.tsx";
import Settings from "./pages/Settings.tsx";
import ChartOfAccounts from "./pages/ChartOfAccounts.tsx";
import Vendors from "./pages/Vendors.tsx";
import Bills from "./pages/Bills.tsx";
import JournalEntries from "./pages/JournalEntries.tsx";
import Budgets from "./pages/Budgets.tsx";
import Projects from "./pages/Projects.tsx";
import TaxCenter from "./pages/TaxCenter.tsx";
import Pricing from "./pages/Pricing.tsx";
import Categorization from "./pages/Categorization.tsx";
import Reconciliation from "./pages/Reconciliation.tsx";
import MonthEndClose from "./pages/MonthEndClose.tsx";
import RevenueRecognition from "./pages/RevenueRecognition.tsx";
import CategorizationRules from "./pages/CategorizationRules.tsx";
import AccountantPortal from "./pages/AccountantPortal.tsx";
import Accruals from "./pages/Accruals.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: (failureCount, error: unknown) => {
        const msg = (error as Error)?.message ?? '';
        if (msg.includes('placeholder') || msg.includes('YOUR_PROJECT_ID')) return false;
        return failureCount < 2;
      },
    },
  },
});

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setTimedOut(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  if (loading && !timedOut) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/invite/:token" element={<AcceptInvite />} />

            {/* Protected app routes */}
            <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
            <Route path="/banking" element={<ProtectedRoute><Banking /></ProtectedRoute>} />
            <Route path="/payroll" element={<ProtectedRoute><Payroll /></ProtectedRoute>} />
            <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
            <Route path="/audit" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

            {/* New feature pages */}
            <Route path="/accounts" element={<ProtectedRoute><ChartOfAccounts /></ProtectedRoute>} />
            <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
            <Route path="/bills" element={<ProtectedRoute><Bills /></ProtectedRoute>} />
            <Route path="/journal-entries" element={<ProtectedRoute><JournalEntries /></ProtectedRoute>} />
            <Route path="/budgets" element={<ProtectedRoute><Budgets /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
            <Route path="/tax" element={<ProtectedRoute><TaxCenter /></ProtectedRoute>} />
            <Route path="/categorization" element={<ProtectedRoute><Categorization /></ProtectedRoute>} />
            <Route path="/reconciliation" element={<ProtectedRoute><Reconciliation /></ProtectedRoute>} />
            <Route path="/month-end-close" element={<ProtectedRoute><MonthEndClose /></ProtectedRoute>} />
            <Route path="/revenue-recognition" element={<ProtectedRoute><RevenueRecognition /></ProtectedRoute>} />
            <Route path="/categorization-rules" element={<ProtectedRoute><CategorizationRules /></ProtectedRoute>} />
            <Route path="/accountant-portal" element={<ProtectedRoute><AccountantPortal /></ProtectedRoute>} />
            <Route path="/accruals" element={<ProtectedRoute><Accruals /></ProtectedRoute>} />

            {/* Public */}
            <Route path="/pricing" element={<Pricing />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
