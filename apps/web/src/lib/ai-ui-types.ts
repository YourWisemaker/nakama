/** Local stand-ins for the few `ai` package types we used (type-only imports). */

export type ChatStatus = "submitted" | "streaming" | "ready" | "error";

export type FileUIPart = {
  filename?: string;
  mediaType: string;
  type: "file";
  url: string;
};

export type UIMessage = {
  role: "system" | "user" | "assistant";
};
