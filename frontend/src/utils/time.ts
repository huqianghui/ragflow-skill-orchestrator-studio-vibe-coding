/**
 * Format a UTC date string from backend as relative time.
 * Backend SQLite func.now() returns UTC without timezone suffix.
 * We append 'Z' so JS Date interprets it correctly.
 */
export function formatRelativeTime(dateStr: string): string {
  const utcStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
  const diff = Date.now() - new Date(utcStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Format a UTC date string as local datetime string.
 */
export function formatLocalDateTime(dateStr: string): string {
  const utcStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
  return new Date(utcStr).toLocaleString();
}
