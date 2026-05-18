import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { FileText, ArrowLeftRight, Receipt, ShoppingCart } from "lucide-react";
import { useCompanies, useCompanyStore } from "@/hooks/useCompanies";
import { useMyFirm } from "@/hooks/useFirm";
import {
  getVisibleSections,
  getAiNavItems,
  getUtilitySection,
  type NavVisibilityContext,
  type NavItem,
} from "@/config/navigation";

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

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ctx = useNavContext();
  const sections = useMemo(() => getVisibleSections(ctx), [ctx]);
  const aiItems = useMemo(() => getAiNavItems(ctx), [ctx]);
  const utilitySection = useMemo(() => getUtilitySection(ctx), [ctx]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    (window as Window & { __openCommandPalette?: () => void }).__openCommandPalette = () => setOpen(true);
    return () => {
      delete (window as Window & { __openCommandPalette?: () => void }).__openCommandPalette;
    };
  }, []);

  const runAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  const runNavItem = (item: NavItem) => {
    if (item.action === "ai-chat") {
      const btn = document.querySelector("[data-ai-chat-trigger]") as HTMLButtonElement;
      btn?.click();
      return;
    }
    navigate(item.path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Quick create">
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/invoices?action=new"))}>
            <FileText className="h-4 w-4" />
            <span>New invoice</span>
          </CommandItem>
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/bills"))}>
            <ShoppingCart className="h-4 w-4" />
            <span>New vendor bill</span>
          </CommandItem>
          <CommandItem className="gap-3" onSelect={() => runAction(() => navigate("/expenses"))}>
            <Receipt className="h-4 w-4" />
            <span>Log expense</span>
          </CommandItem>
          <CommandItem
            className="gap-3"
            onSelect={() =>
              runAction(() => {
                window.dispatchEvent(new CustomEvent("open-new-transaction"));
              })
            }
          >
            <ArrowLeftRight className="h-4 w-4" />
            <span>Quick entry</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="AI & close">
          {aiItems.map((item) => (
            <CommandItem
              key={item.label + item.path}
              className="gap-3"
              onSelect={() => runAction(() => runNavItem(item))}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {sections.map((section) => (
          <CommandGroup key={section.id} heading={section.label}>
            {section.items.map((item) => (
              <CommandItem
                key={item.path}
                className="gap-3"
                onSelect={() => runAction(() => navigate(item.path))}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}

        <CommandSeparator />

        {utilitySection && (
          <CommandGroup heading={utilitySection.label}>
            {utilitySection.items.map((item) => (
              <CommandItem
                key={item.path}
                className="gap-3"
                onSelect={() => runAction(() => navigate(item.path))}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
