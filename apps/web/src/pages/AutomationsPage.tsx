import type { KeyboardEvent, ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  type AgentWorkTab,
  agentWorkTabFromSearchParams,
} from "@/lib/navigation";
import { AutomationsDialogs } from "@/pages/automations/automations-dialogs";
import { AutomationsPageLayout } from "@/pages/automations/automations-page-layout";
import { useAutomationsPage } from "@/pages/automations/use-automations-page";
import { TasksPage } from "@/pages/TasksPage";

export function AutomationsPage() {
  const state = useAutomationsPage();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = agentWorkTabFromSearchParams(searchParams);

  function selectTab(tab: AgentWorkTab) {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (tab === "automations") {
      nextSearchParams.delete("tab");
    } else {
      nextSearchParams.set("tab", tab);
    }
    setSearchParams(nextSearchParams);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-border border-b bg-card px-6 py-2">
        <div aria-label="Agent work views" role="tablist">
          <TabButton
            active={activeTab === "automations"}
            onClick={() => selectTab("automations")}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") {
                event.preventDefault();
                selectTab("tasks");
                document.getElementById("agent-work-tab-tasks")?.focus();
              }
            }}
            tab="automations"
          >
            Automations
          </TabButton>
          <TabButton
            active={activeTab === "tasks"}
            onClick={() => selectTab("tasks")}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                selectTab("automations");
                document.getElementById("agent-work-tab-automations")?.focus();
              }
            }}
            tab="tasks"
          >
            Tasks
          </TabButton>
        </div>
      </div>
      {activeTab === "automations" ? (
        <div
          aria-labelledby="agent-work-tab-automations"
          className="min-h-0 flex-1"
          id="agent-work-panel-automations"
          role="tabpanel"
        >
          <AutomationsPageLayout {...state} />
        </div>
      ) : (
        <div
          aria-labelledby="agent-work-tab-tasks"
          className="min-h-0 flex-1"
          id="agent-work-panel-tasks"
          role="tabpanel"
        >
          <TasksPage />
        </div>
      )}
      <AutomationsDialogs {...state} />
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
  onKeyDown,
  tab,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  tab: AgentWorkTab;
}) {
  return (
    <button
      aria-controls={`agent-work-panel-${tab}`}
      aria-selected={active}
      className={`rounded-md px-3 py-1.5 font-medium text-sm transition-colors hover:bg-muted ${
        active ? "bg-muted text-foreground" : "text-muted-foreground"
      }`}
      id={`agent-work-tab-${tab}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role="tab"
      tabIndex={active ? 0 : -1}
      type="button"
    >
      {children}
    </button>
  );
}
