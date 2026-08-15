import type { WorklogConflict } from '@/types';

/**
 * Ask whether an overlapping entry should be saved anyway.
 *
 * An overlap is a question rather than a verdict — sometimes it is deliberate —
 * so the user answers it and the write is re-run with `allowOverlap`. The prompt
 * is `window.confirm`, which is what the clock-out discard already uses; a
 * second `<dialog>` over an open one is not workable here, because the conflict
 * can arrive while a modal is on screen.
 *
 * `message` is the one the server composed, so it names the entry the new one
 * would land on rather than only stating that something collided.
 */
export function confirmOverlap(result: {
  message: string;
  conflicts: WorklogConflict[];
}) {
  return window.confirm(`${result.message} Save anyway?`);
}
