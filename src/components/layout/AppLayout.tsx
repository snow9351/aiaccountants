import { ReactNode, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { AIChat } from "@/components/AIChat";
import { Menu } from "lucide-react";

export function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-mesh">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <AppSidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:ml-[240px] transition-all duration-300">
        <TopBar onMenuToggle={() => setSidebarOpen(true)} />
        <main className="p-3 sm:p-4 lg:p-6">{children}</main>
      </div>
      <AIChat />
    </div>
  );
}
