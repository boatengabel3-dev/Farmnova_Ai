const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats an ISO calendar date ('YYYY-MM-DD' or timestamp) without local-timezone day shifting.
 */
export function formatCalendarDate(isoDateOrTimestamp: string | null | undefined): string {
  if (!isoDateOrTimestamp) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDateOrTimestamp.trim());
  if (!match) return isoDateOrTimestamp;
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  const mon = MONTHS_SHORT[monthIdx] ?? match[2];
  return `${mon} ${day}, ${year}`;
}

/**
 * Computes whole calendar days elapsed from a 'YYYY-MM-DD' date until today in UTC.
 */
export function daysSinceCalendarDate(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!match) return null;
  const startUtcMs = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = new Date();
  const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((todayUtcMs - startUtcMs) / 86400_000));
}

export function todayUtcIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatUtcTimestamp(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return '—';
  try {
    const d = new Date(isoTimestamp);
    if (Number.isNaN(d.getTime())) return isoTimestamp;
    return `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
  } catch {
    return isoTimestamp;
  }
}
