import type { LucideIcon } from "lucide-react";
import {
  PanelLeftIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppContext } from "@/context/use-app-context";
import { useAuth } from "@/context/use-auth";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { ProfileRail } from "@/components/ProfileRail";
import { SidebarUserMenu } from "@/components/SidebarUserMenu";
import { usePrefetchAppData } from "@/hooks/use-app-queries";
import { useAutomationUnreadTotal } from "@/hooks/use-automations";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { cn } from "@/lib/utils";
import { chatProfileIdFromPath } from "@/lib/chat-history";
import {
  findNavItem,
  navHrefForPage,
  NAV_GROUPS,
  NAV_ITEM_ICONS,
  canAccessSystemPage,
  canAccessIntegrationsPage,
  PAGE_PATHS,
  PLATFORM_ADMIN_PAGE_IDS,
  pageIdFromPath,
  type NavItem,
} from "@/lib/navigation";

export function Layout() {
  const location = useLocation();
  const page = pageIdFromPath(location.pathname) ?? "chat";
  const chatProfileId = chatProfileIdFromPath(location.pathname);
  const { error } = useAppContext();
  const { user, activeOrg } = useAuth();
  const prefetchAppData = usePrefetchAppData();
  const { data: automationUnreadTotal = 0 } = useAutomationUnreadTotal();
  const { collapsed, toggle } = useSidebarCollapsed();
  const [search, setSearch] = useState("");
  const activeNav = findNavItem(page);
  const navGroups = useMemo(() => {
    const groups: typeof NAV_GROUPS = [];

    for (const group of NAV_GROUPS) {
      const items = group.items.filter((item) => {
        if (item.id === "soul") {
          return canAccessSystemPage(user?.isPlatformAdmin === true, activeOrg?.role);
        }

        if (item.id === "integrations") {
          return canAccessIntegrationsPage(activeOrg?.role);
        }

        return (
          !PLATFORM_ADMIN_PAGE_IDS.has(item.id) || user?.isPlatformAdmin === true
        );
      });

      if (items.length > 0) {
        groups.push({ ...group, items });
      }
    }

    return groups;
  }, [activeOrg?.role, user?.isPlatformAdmin]);

  const filteredNavGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return navGroups;
    }
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.label.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query) ||
            group.label.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [navGroups, search]);

  return (
    <TooltipProvider delay={0}>
      <div className="flex h-svh overflow-hidden bg-background">
        <ProfileRail />

        <aside
          aria-label="Main navigation"
          data-collapsed={collapsed || undefined}
          className={cn(
            "flex h-full shrink-0 flex-col overflow-hidden border-r border-border/50 bg-sidebar transition-[width] duration-200 ease-out motion-reduce:transition-none",
            collapsed ? "w-14" : "w-60",
          )}
        >
          <div
            className={cn(
              "app-shell-header",
              collapsed ? "h-auto min-h-14 flex-col gap-2 px-2 py-3" : "gap-2.5 px-3",
            )}
          >
            <div className={cn("min-w-0", collapsed ? "hidden" : "flex-1")}>
              <OrgSwitcher collapsed={collapsed} />
            </div>
            <SidebarCollapseButton collapsed={collapsed} onToggle={toggle} />
          </div>

          {collapsed ? null : (
            <div className="shrink-0 px-3 pb-2 pt-3">
              <SidebarSearchInput value={search} onChange={setSearch} />
            </div>
          )}

          <nav
            className={cn(
              "no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto",
              collapsed ? "p-2" : "p-3",
            )}
          >
            {filteredNavGroups.map((group, groupIndex) => (
              <div key={group.id}>
                {groupIndex > 0 ? (
                  <div className="sidebar-nav-divider" aria-hidden="true" />
                ) : null}
                <div
                  className="sidebar-nav-group"
                  role="group"
                  aria-label={group.label}
                >
                  {!collapsed ? (
                    <p className="sidebar-nav-group-label">{group.label}</p>
                  ) : null}
                  <div className="sidebar-nav-group-items">
                    {group.items.map((item) => (
                      <SidebarNavButton
                        key={item.id}
                        item={item}
                        icon={NAV_ITEM_ICONS[item.id]}
                        active={item.id === page}
                        collapsed={collapsed}
                        badge={item.id === "automations" ? automationUnreadTotal : undefined}
                        to={
                          item.id === "soul"
                            ? `${navHrefForPage(item.id, chatProfileId)}?tab=tools`
                            : navHrefForPage(item.id, chatProfileId)
                        }
                        onPrefetch={
                          item.id === "automations" ? prefetchAppData : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {!collapsed && filteredNavGroups.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No matches.</p>
            ) : null}
          </nav>

          <div
            className={cn(
              "sidebar-nav-footer flex shrink-0 flex-col border-t border-border/50",
              collapsed ? "justify-center px-2 py-2.5" : "px-3 py-3",
            )}
          >
            <SidebarUserMenu collapsed={collapsed} />
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {page !== "chat" ? (
            <header className="app-shell-header gap-4 bg-card px-6">
              <h1 className="type-brand min-w-0 truncate">{activeNav?.label}</h1>
            </header>
          ) : null}

          {error ? (
            <div className="shrink-0 border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          ) : null}

          <main
            className={
              page === "chat" ||
              page === "tasks" ||
              page === "automations" ||
              location.pathname.startsWith(`${PAGE_PATHS.soul}/playground/`)
                ? "flex min-h-0 flex-1 flex-col overflow-hidden"
                : "min-h-0 flex-1 overflow-y-auto p-6"
            }
          >
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

function SidebarCollapseButton({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!collapsed}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      onClick={onToggle}
      className="shrink-0 text-muted-foreground/70 hover:text-foreground"
    >
      <PanelLeftIcon className="size-4" strokeWidth={1.75} />
    </Button>
  );
}

function SidebarSearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const isSearching = value.trim().length > 0;

  return (
    <div className="relative flex items-center">
      <SearchIcon
        className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground/60"
        strokeWidth={1.75}
        aria-hidden
      />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search anything..."
        aria-label="Search navigation"
        className="h-8 w-full rounded-md border border-border/60 bg-background/60 pl-8 pr-8 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      />
      {isSearching ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2 flex size-4 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-3.5" strokeWidth={1.75} aria-hidden />
        </button>
      ) : (
        <kbd
          className="pointer-events-none absolute right-2 hidden h-4 select-none items-center rounded border border-border/60 bg-muted/60 px-1 text-[10px] font-medium text-muted-foreground/70 sm:inline-flex"
          aria-hidden
        >
          /
        </kbd>
      )}
    </div>
  );
}

function SidebarNavButton({
  item,
  icon: Icon,
  active,
  collapsed,
  to,
  onPrefetch,
  badge,
  className,
}: {
  item: NavItem;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
  to: string;
  onPrefetch?: () => void;
  badge?: number;
  className?: string;
}) {
  const showBadge = Boolean(badge && badge > 0);
  const badgeLabel = badge && badge > 99 ? "99+" : String(badge ?? "");

  const link = (
    <Link
      to={to}
      title={collapsed ? undefined : item.description}
      aria-label={
        showBadge ? `${item.label}, ${badge} unread automation run${badge === 1 ? "" : "s"}` : item.label
      }
      aria-current={active ? "page" : undefined}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      data-active={active || undefined}
      className={cn(
        "sidebar-nav-link",
        collapsed && "sidebar-nav-link--collapsed",
        className,
      )}
    >
      <span className="relative shrink-0">
        <Icon
          className="sidebar-nav-icon"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        {showBadge && collapsed ? (
          <span
            className="absolute right-0 top-0 inline-flex h-[18px] min-w-[18px] translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-sidebar bg-primary px-1.5 text-[10px] font-bold leading-none tabular-nums text-primary-foreground shadow-sm"
            aria-hidden
          >
            {badgeLabel}
          </span>
        ) : null}
      </span>
      {!collapsed ? (
        <>
          <span className="min-w-0 truncate">{item.label}</span>
          {showBadge ? (
            <span
              className="ml-auto inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary-foreground"
              aria-hidden
            >
              {badgeLabel}
            </span>
          ) : null}
        </>
      ) : null}
    </Link>
  );

  if (!collapsed) {
    return link;
  }

  const tooltipLabel = showBadge
    ? `${item.label} (${badge} unread)`
    : item.label;

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right" sideOffset={8}>
        {tooltipLabel}
      </TooltipContent>
    </Tooltip>
  );
}
