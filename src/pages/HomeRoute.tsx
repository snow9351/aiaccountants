import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import LandingPage from "@/pages/LandingPage";

/** Marketing home; signed-in users go to the app unless they opt into the public site. */
export default function HomeRoute() {
  const { isAuthenticated, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const publicView = searchParams.get("public") === "1";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated && !publicView) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LandingPage />;
}
