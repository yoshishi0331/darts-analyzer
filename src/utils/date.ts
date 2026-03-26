function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatShortDate(isoString: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(isoString));
}

export function getDateKey(isoString: string): string {
  const date = new Date(isoString);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(): string {
  return getDateKey(new Date().toISOString());
}
