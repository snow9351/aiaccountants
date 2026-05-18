import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import Pricing from "@/pages/Pricing";

/** Public pricing for guests; same page inside app chrome when signed in. */
export default function PricingPage() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <AppLayout>
        <div className="overflow-visible">
          <Pricing embedded />
        </div>
      </AppLayout>
    );
  }

  return <Pricing />;
}
