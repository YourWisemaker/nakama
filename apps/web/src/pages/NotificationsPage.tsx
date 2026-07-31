import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { NotificationList } from "@/components/notifications/notification-list";
import { useNotifications } from "@/hooks/use-notifications";

function NotificationSection({
  title,
  description,
  count,
  children,
}: {
  title: string;
  description: string;
  count: number;
  children: ReactNode;
}) {
  if (count === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium text-foreground">
          {title}
          <span className="ml-2 text-xs font-normal text-muted-foreground">({count})</span>
        </h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function NotificationsPage() {
  const { automationItems, orgMemoryItems, totalCount, isLoading } = useNotifications();

  if (isLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
        <Spinner className="size-5" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Card className="overflow-hidden shadow-none">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {totalCount === 0
              ? "No unread notifications right now."
              : `${totalCount} unread notification${totalCount === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="space-y-6 px-4 py-4">
          {totalCount === 0 ? (
            <p className="text-sm text-muted-foreground">
              Automation runs and org memory proposals will show up here when they need your
              attention.
            </p>
          ) : (
            <>
              <NotificationSection
                title="Automation runs"
                description="Unread results from scheduled or manual automation runs."
                count={automationItems.length}
              >
                <NotificationList items={automationItems} />
              </NotificationSection>

              <NotificationSection
                title="Org memory proposals"
                description="Facts proposed by agents that need admin approval."
                count={orgMemoryItems.length}
              >
                <NotificationList items={orgMemoryItems} />
              </NotificationSection>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
