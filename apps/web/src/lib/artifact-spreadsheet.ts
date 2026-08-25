export type SpreadsheetRows = string[][];

function fileExtension(filename: string): string {
  const clean =
    filename.toLowerCase().split(/[?#]/)[0] ?? filename.toLowerCase();
  const index = clean.lastIndexOf(".");
  return index >= 0 ? clean.slice(index + 1) : "";
}

export function delimiterForSpreadsheetFilename(filename: string): string {
  return fileExtension(filename) === "tsv" ? "\t" : ",";
}

export function parseDelimitedSpreadsheet(
  content: string,
  delimiter: string
): SpreadsheetRows {
  const rows: SpreadsheetRows = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
      continue;
    }

    if (char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    cell += char;
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.length > 0 ? rows : [[""]];
}

export function serializeDelimitedSpreadsheet(
  rows: SpreadsheetRows,
  delimiter: string
): string {
  return `${rows
    .map((row) =>
      row
        .map((value) => {
          const cell = String(value ?? "");
          if (!(cell.includes(delimiter) || /["\r\n]/.test(cell))) {
            return cell;
          }
          return `"${cell.replace(/"/g, '""')}"`;
        })
        .join(delimiter)
    )
    .join("\n")}\n`;
}

export function parseSpreadsheetText(
  filename: string,
  content: string
): SpreadsheetRows {
  return normalizeSpreadsheetShape(
    parseDelimitedSpreadsheet(
      content,
      delimiterForSpreadsheetFilename(filename)
    )
  );
}

export function serializeSpreadsheetText(
  filename: string,
  rows: SpreadsheetRows
): string {
  return serializeDelimitedSpreadsheet(
    normalizeSpreadsheetShape(rows),
    delimiterForSpreadsheetFilename(filename)
  );
}

export function normalizeSpreadsheetShape(
  rows: SpreadsheetRows
): SpreadsheetRows {
  const width = Math.max(1, ...rows.map((row) => row.length));
  const normalized = rows.map((row) =>
    Array.from({ length: width }, (_, index) => row[index] ?? "")
  );
  return normalized.length > 0 ? normalized : [[""]];
}

export function cloneSpreadsheetRows(rows: SpreadsheetRows): SpreadsheetRows {
  return rows.map((row) => [...row]);
}
