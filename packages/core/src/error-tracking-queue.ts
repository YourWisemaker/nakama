import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ErrorReport } from "./error-tracking";
import { getErrorTrackingConfigDir } from "./error-tracking-config";
import { PRIVATE_DIR_MODE, PRIVATE_FILE_MODE } from "./fs";

/**
 * An uncaught exception kills the process before any async send can finish, so the
 * report is written here synchronously and delivered by whichever process starts next.
 * Measured, not assumed: with uncaughtExceptionMonitor even the "exit" handler does not
 * run, while a writeFileSync inside the monitor completes.
 *
 * A send that fails for any other reason leaves its entry behind too, so the queue
 * doubles as the retry.
 */
export const MAX_PENDING_ERROR_REPORTS = 5;

export function getPendingErrorReportsPath(): string {
  return join(getErrorTrackingConfigDir(), "pending.json");
}

export function readPendingErrorReports(): ErrorReport[] {
  try {
    const parsed: unknown = JSON.parse(
      readFileSync(getPendingErrorReportsPath(), "utf8")
    );
    return Array.isArray(parsed) ? (parsed as ErrorReport[]) : [];
  } catch {
    // Missing, unreadable or corrupt all mean the same thing: nothing to deliver.
    return [];
  }
}

function write(reports: ErrorReport[]): void {
  mkdirSync(getErrorTrackingConfigDir(), {
    mode: PRIVATE_DIR_MODE,
    recursive: true,
  });
  writeFileSync(getPendingErrorReportsPath(), JSON.stringify(reports), {
    mode: PRIVATE_FILE_MODE,
  });
}

/** Synchronous on purpose. See the note above. */
export function appendPendingErrorReport(report: ErrorReport): void {
  try {
    write(
      [...readPendingErrorReports(), report].slice(-MAX_PENDING_ERROR_REPORTS)
    );
  } catch {
    // A full or read-only config dir must not turn one crash into two.
  }
}

export function removePendingErrorReport(id: string): void {
  try {
    write(readPendingErrorReports().filter((report) => report.id !== id));
  } catch {
    // Worst case the report is delivered twice, and the event id collapses it at the
    // ingest. That is strictly better than failing here.
  }
}
