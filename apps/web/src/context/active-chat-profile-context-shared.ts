import { createContext } from "react";

export interface ActiveChatProfileContextValue {
  profileId: string | null;
  setProfileId: (profileId: string) => void;
}

export const ActiveChatProfileContext =
  createContext<ActiveChatProfileContextValue | null>(null);
