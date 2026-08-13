import { describe, expect, test } from "bun:test";
import { builtinTools } from "./builtin";

const MUTATING_BUILTIN_NAMES = [
  "write_file",
  "write_docx",
  "delete_file",
  "edit_file",
  "email",
] as const;

describe("builtin parallelSafe contract", () => {
  test("mutating file and side-effect tools are sequential", () => {
    for (const name of MUTATING_BUILTIN_NAMES) {
      const tool = builtinTools.find((entry) => entry.name === name);
      expect(tool).toBeTruthy();
      expect(tool?.parallelSafe).not.toBe(true);
    }
  });

  test("read and search tools may run in parallel", () => {
    for (const name of [
      "read_file",
      "search_files",
      "knowledge_base_search",
      "web_search",
      "web_fetch",
    ]) {
      expect(
        builtinTools.find((entry) => entry.name === name)?.parallelSafe
      ).toBe(true);
    }
  });
});
