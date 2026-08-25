import { Add01Icon } from "hugeicons-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  cloneSpreadsheetRows,
  normalizeSpreadsheetShape,
  parseSpreadsheetText,
  type SpreadsheetRows,
  serializeSpreadsheetText,
} from "@/lib/artifact-spreadsheet";
import { cn } from "@/lib/utils";

function SpreadsheetGrid({
  rows,
  editable,
  onChangeCell,
}: {
  rows: SpreadsheetRows;
  editable: boolean;
  onChangeCell?: (rowIndex: number, columnIndex: number, value: string) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full border-collapse text-xs">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              className={cn(
                rowIndex === 0 && "bg-muted/40 font-medium",
                rowIndex > 0 && rowIndex % 2 === 0 && "bg-muted/20"
              )}
              key={`row-${rowIndex}`}
            >
              {row.map((cell, columnIndex) => (
                <td
                  className="border-border border-b not-first:border-l p-0 align-top"
                  key={`cell-${rowIndex}-${columnIndex}`}
                >
                  {editable ? (
                    <input
                      className="h-8 w-full min-w-[7.5rem] bg-transparent px-2 text-foreground outline-none focus:bg-muted/50"
                      onChange={(event) =>
                        onChangeCell?.(
                          rowIndex,
                          columnIndex,
                          event.target.value
                        )
                      }
                      value={cell}
                    />
                  ) : (
                    <div className="min-w-[7.5rem] whitespace-pre-wrap break-words px-2 py-2 text-foreground">
                      {cell}
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ArtifactSpreadsheetPreview({
  content,
  filename,
}: {
  content: string;
  filename: string;
}) {
  const rows = useMemo(
    () => parseSpreadsheetText(filename, content),
    [content, filename]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SpreadsheetGrid editable={false} rows={rows} />
    </div>
  );
}

export function ArtifactSpreadsheetEditor({
  busy,
  content,
  error,
  filename,
  onCancel,
  onSave,
}: {
  busy: boolean;
  content: string;
  error: string | null;
  filename: string;
  onCancel: () => void;
  onSave: (nextContent: string) => void;
}) {
  const [rows, setRows] = useState<SpreadsheetRows>(() =>
    parseSpreadsheetText(filename, content)
  );
  const [baseRows, setBaseRows] = useState<SpreadsheetRows>(() =>
    cloneSpreadsheetRows(parseSpreadsheetText(filename, content))
  );

  useEffect(() => {
    const next = parseSpreadsheetText(filename, content);
    setRows(next);
    setBaseRows(cloneSpreadsheetRows(next));
  }, [content, filename]);

  const isDirty = useMemo(
    () => JSON.stringify(rows) !== JSON.stringify(baseRows),
    [baseRows, rows]
  );

  function updateCell(rowIndex: number, columnIndex: number, value: string) {
    setRows((current) => {
      const next = cloneSpreadsheetRows(current);
      next[rowIndex] = [...(next[rowIndex] ?? [])];
      next[rowIndex]![columnIndex] = value;
      return normalizeSpreadsheetShape(next);
    });
  }

  function addRow() {
    setRows((current) =>
      normalizeSpreadsheetShape([
        ...current,
        Array.from({ length: Math.max(1, current[0]?.length ?? 1) }, () => ""),
      ])
    );
  }

  function addColumn() {
    setRows((current) =>
      normalizeSpreadsheetShape(current.map((row) => [...row, ""]))
    );
  }

  function discard() {
    setRows(cloneSpreadsheetRows(baseRows));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {error ? (
        <p className="shrink-0 border-border border-b px-3 py-2 text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <div className="flex shrink-0 items-center gap-2 border-border border-b px-3 py-2">
        <Button
          disabled={busy}
          onClick={addRow}
          size="xs"
          type="button"
          variant="ghost"
        >
          <Add01Icon aria-hidden className="size-3" />
          Row
        </Button>
        <Button
          disabled={busy}
          onClick={addColumn}
          size="xs"
          type="button"
          variant="ghost"
        >
          <Add01Icon aria-hidden className="size-3" />
          Column
        </Button>
        <div className="min-w-0 flex-1" />
        <Button
          disabled={busy}
          onClick={isDirty ? discard : onCancel}
          size="xs"
          type="button"
          variant="ghost"
        >
          {isDirty ? "Discard" : "Cancel"}
        </Button>
        <Button
          disabled={busy || !isDirty}
          onClick={() => onSave(serializeSpreadsheetText(filename, rows))}
          size="xs"
          type="button"
        >
          {busy ? <Spinner className="size-3.5" /> : "Save"}
        </Button>
      </div>

      <SpreadsheetGrid editable={!busy} onChangeCell={updateCell} rows={rows} />
    </div>
  );
}
