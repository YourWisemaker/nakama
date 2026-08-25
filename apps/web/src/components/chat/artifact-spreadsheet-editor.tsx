import { Add01Icon } from "hugeicons-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  normalizeSpreadsheetShape,
  parseSpreadsheetText,
  type SpreadsheetRows,
  serializeSpreadsheetText,
} from "@/lib/artifact-spreadsheet";
import { cn } from "@/lib/utils";

export function SpreadsheetGrid({
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
              {row.map((cell, columnIndex) => {
                const header = rows[0]?.[columnIndex]?.trim();
                const columnLabel =
                  header && header.length > 0
                    ? header
                    : `Column ${columnIndex + 1}`;
                const cellLabel =
                  rowIndex === 0
                    ? `Header ${columnLabel}`
                    : `${columnLabel}, row ${rowIndex}`;

                return (
                  <td
                    className="border-border border-b not-first:border-l p-0 align-top"
                    key={`cell-${rowIndex}-${columnIndex}`}
                  >
                    {editable ? (
                      <input
                        aria-label={cellLabel}
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
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
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
    structuredClone(parseSpreadsheetText(filename, content))
  );

  useEffect(() => {
    const next = parseSpreadsheetText(filename, content);
    setRows(next);
    setBaseRows(structuredClone(next));
  }, [content, filename]);

  const isDirty = JSON.stringify(rows) !== JSON.stringify(baseRows);

  function updateCell(rowIndex: number, columnIndex: number, value: string) {
    setRows((current) =>
      normalizeSpreadsheetShape(
        current.map((row, currentRowIndex) => {
          if (currentRowIndex !== rowIndex) {
            return row;
          }

          const length = Math.max(row.length, columnIndex + 1);
          return Array.from({ length }, (_, currentColumnIndex) =>
            currentColumnIndex === columnIndex
              ? value
              : (row[currentColumnIndex] ?? "")
          );
        })
      )
    );
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
    setRows(structuredClone(baseRows));
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
