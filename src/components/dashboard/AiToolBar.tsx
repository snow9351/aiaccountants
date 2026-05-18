import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompanies, useCompanyStore } from "@/hooks/useCompanies";
import { useMyFirm } from "@/hooks/useFirm";
import { getAiNavItems, type NavItem, type NavVisibilityContext } from "@/config/navigation";

function useNavContext(): NavVisibilityContext {
  const { data: companies = [] } = useCompanies();
  const { activeOrgId } = useCompanyStore();
  const { data: firm } = useMyFirm();
  const activeCompany = companies.find((c) => c.id === activeOrgId) ?? companies[0];
  const role = activeCompany?.role as string | undefined;
  return {
    isOwner: role === "owner",
    isAccountant: role === "accountant",
    isBookkeeper: role === "bookkeeper",
    isReadOnly: role === "read_only",
    hasFirm: !!firm?.id,
  };
}

function openAiChat() {
  const btn = document.querySelector("[data-ai-chat-trigger]") as HTMLButtonElement;
  btn?.click();
}

export function AiToolBar() {
  const navigate = useNavigate();
  const items = getAiNavItems(useNavContext());

  const onItem = (item: NavItem) => {
    if (item.action === "ai-chat") {
      openAiChat();
      return;
    }
    navigate(item.path);
  };

  return (
    <div className="mb-6 rounded-xl border border-border bg-muted/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">AI & close</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.label + item.path}
            type="button"
            onClick={() => onItem(item)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border border-border/50 bg-card/80 px-3.5 py-2 text-sm font-medium text-foreground",
              "transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
