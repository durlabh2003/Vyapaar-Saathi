/**
 * Local transaction queue for weak connectivity.
 *
 * A failed write is stored on the device and replayed when the network returns,
 * so a shopkeeper never loses an entry because the signal dropped.
 */
const KEY = "vs.queue.transactions";

export type QueuedTransaction = Record<string, unknown> & { _queuedAt: string };

function read(): QueuedTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedTransaction[]) : [];
  } catch {
    return [];
  }
}

function write(rows: QueuedTransaction[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {
    /* device storage full — nothing more we can do */
  }
}

export function enqueue(row: Record<string, unknown>) {
  const rows = read();
  rows.push({ ...row, _queuedAt: new Date().toISOString() });
  write(rows);
  return rows.length;
}

export function pendingCount() {
  return read().length;
}

export async function flush(
  send: (row: Record<string, unknown>) => Promise<void>,
): Promise<number> {
  const rows = read();
  if (!rows.length) return 0;

  const remaining: QueuedTransaction[] = [];
  let sent = 0;
  for (const row of rows) {
    const { _queuedAt: _ignored, ...payload } = row;
    try {
      await send(payload);
      sent += 1;
    } catch {
      remaining.push(row);
    }
  }
  write(remaining);
  return sent;
}
