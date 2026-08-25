import { createContext } from "react";
import type { SourceDocumentUIPart } from "@/lib/ai-ui-types";

export interface ReferencedSourcesContext {
  add: (sources: SourceDocumentUIPart[] | SourceDocumentUIPart) => void;
  clear: () => void;
  remove: (id: string) => void;
  sources: (SourceDocumentUIPart & { id: string })[];
}

export const LocalReferencedSourcesContext =
  createContext<ReferencedSourcesContext | null>(null);
