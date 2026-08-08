import type { ProfileSummary, StoredTask } from "@nakama/core/contract";
import { useQueryClient } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useTaskMessagesQuery } from "@/hooks/use-tasks";
import { type ChatListItem, chatMessagesToListItems } from "@/lib/chat-history";
import {
  appendOutgoingMessages,
  buildStreamHandlers,
  deriveChatStatus,
  finalizeStreamingMessages,
  isAbortError,
} from "@/lib/chat-stream";
import { client, formatError } from "@/lib/client";
import { NAV_ITEM_ICONS } from "@/lib/navigation";
import { queryKeys } from "@/lib/query-keys";
import { TASK_STATUS_BADGE } from "@/lib/task-board";
import { cn } from "@/lib/utils";

const ChatNavIcon = NAV_ITEM_ICONS.chat;

interface TaskRunHistoryPanelProps {
  onClose: () => void;
  profile?: ProfileSummary | null;
  task: StoredTask;
}

export function TaskRunHistoryPanel({
  task,
  profile,
  onClose,
}: TaskRunHistoryPanelProps) {
  const queryClient = useQueryClient();
  const {
    data,
    isLoading,
    isFetching,
    error: loadError,
  } = useTaskMessagesQuery(task.id);

  const [messages, setMessages] = useState<ChatListItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(task.sessionId);
  const [busy, setBusy] = useState(false);
  const [canStop, setCanStop] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamAbortRef = useRef<AbortController | null>(null);
  const statusBadge = TASK_STATUS_BADGE[task.status];
  const profileLabel = profile?.name ?? task.profileId;

  const waitingForMessages = isLoading || (isFetching && messages.length === 0);
  const [syncedData, setSyncedData] = useState(data);

  if (data !== syncedData) {
    setSyncedData(data);
    if (data) {
      setSessionId(data.sessionId || task.sessionId);
      setMessages(chatMessagesToListItems(data.messages));
      setError(null);

      if (!task.sessionId && data.sessionId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      }
    }
  }

  const chatStatus = useMemo(
    () => deriveChatStatus(busy, error, messages),
    [busy, error, messages]
  );

  const stopStreaming = useCallback(() => {
    streamAbortRef.current?.abort();
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || busy || !sessionId) {
        return;
      }

      setBusy(true);
      setError(null);

      const chatSession = client.createChatSession(sessionId, "task");
      appendOutgoingMessages(setMessages, text);

      const abortController = new AbortController();
      streamAbortRef.current = abortController;
      setCanStop(true);

      try {
        await chatSession.sendStream(
          { message: text },
          buildStreamHandlers(setMessages),
          { signal: abortController.signal }
        );

        setMessages((current) => finalizeStreamingMessages(current));
        void queryClient.invalidateQueries({
          queryKey: queryKeys.tasks.messages(task.id),
        });
      } catch (err) {
        if (isAbortError(err)) {
          setMessages((current) => finalizeStreamingMessages(current));
          return;
        }

        setError(formatError(err));
        setMessages((current) =>
          current.filter((message) => !message.streaming)
        );
      } finally {
        streamAbortRef.current = null;
        setCanStop(false);
        setBusy(false);
      }
    },
    [busy, queryClient, sessionId, task.id]
  );

  const displayError = error ?? (loadError ? formatError(loadError) : null);
  const chatUnavailable =
    !(sessionId || waitingForMessages) && messages.length > 0;
  const emptyHistory =
    !(waitingForMessages || displayError) && messages.length === 0;

  return (
    <aside
      aria-label={`Run chat for ${task.title}`}
      className={cn(
        "flex min-h-[24rem] shrink-0 flex-col bg-background",
        "border-border/50 border-t",
        "lg:h-full lg:min-h-0 lg:w-[24rem] lg:border-border/30 lg:border-t-0 lg:border-l",
        "xl:w-[26rem]"
      )}
    >
      <header className="flex items-start justify-between gap-3 border-border/50 border-b bg-muted/20 px-4 py-4 sm:px-5">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <ChatNavIcon
              aria-hidden
              className="sidebar-nav-icon text-muted-foreground"
              strokeWidth={1.75}
            />
            <p className="type-label">Run chat</p>
          </div>
          <h2 className="truncate font-semibold text-foreground text-sm">
            {task.title}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-medium text-[11px]",
                statusBadge.className
              )}
            >
              {statusBadge.label}
            </span>
            <span className="truncate text-muted-foreground text-xs">
              {profileLabel}
            </span>
          </div>
        </div>
        <Button
          aria-label="Close task chat"
          className="shrink-0"
          onClick={onClose}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <XIcon aria-hidden className="size-4" />
        </Button>
      </header>

      <div className="relative min-h-0 flex-1">
        {waitingForMessages ? (
          <div className="flex h-full min-h-48 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : (
          <ChatMessageList
            className="absolute inset-0 bg-background"
            contentClassName="px-4 sm:px-5"
            emptyMessage={
              emptyHistory
                ? "No run output yet. Open task details or run the agent again."
                : undefined
            }
            messages={messages}
          />
        )}
      </div>

      {displayError ? (
        <div className="shrink-0 border-border/50 border-t px-4 py-3 sm:px-5">
          <p className="text-red-700 text-sm dark:text-red-300">
            {displayError}
          </p>
        </div>
      ) : null}

      {chatUnavailable ? (
        <div className="shrink-0 space-y-2 border-border/50 border-t px-4 py-4 sm:px-5">
          <p className="text-muted-foreground text-sm">
            Run history is shown above. Restart the Nakama server to enable
            follow-up chat.
          </p>
        </div>
      ) : (
        <ChatComposer
          busy={busy}
          canStop={canStop}
          chatStatus={chatStatus}
          className="border-border/50 border-t px-4 py-4 sm:px-5"
          disabled={!sessionId || waitingForMessages}
          error={displayError}
          onStop={stopStreaming}
          onSubmit={(text) => void sendMessage(text)}
          placeholder="Follow up on this task…"
          variant="minimal"
        />
      )}
    </aside>
  );
}
