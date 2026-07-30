import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  ActiveChatProfileContext,
  type ActiveChatProfileContextValue,
} from "@/context/active-chat-profile-context-shared";
import {
  readStoredActiveChatProfileId,
  writeStoredActiveChatProfileId,
} from "@/lib/chat-history";

export function ActiveChatProfileProvider({ children }: { children: ReactNode }) {
  const [profileId, setProfileIdState] = useState<string | null>(() =>
    readStoredActiveChatProfileId(),
  );

  const setProfileId = useCallback((nextProfileId: string) => {
    setProfileIdState(nextProfileId);
    writeStoredActiveChatProfileId(nextProfileId);
  }, []);

  const value = useMemo<ActiveChatProfileContextValue>(
    () => ({
      profileId,
      setProfileId,
    }),
    [profileId, setProfileId],
  );

  return (
    <ActiveChatProfileContext.Provider value={value}>
      {children}
    </ActiveChatProfileContext.Provider>
  );
}
