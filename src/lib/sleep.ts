const clockMinutes = (value: string | null | undefined) => {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

export function calculateSleepDurationMinutes(start: string | null | undefined, end: string | null | undefined) {
  const startMinutes = clockMinutes(start);
  const endMinutes = clockMinutes(end);
  if (startMinutes === null || endMinutes === null) return null;

  const duration = (endMinutes - startMinutes + 24 * 60) % (24 * 60);
  return duration === 0 ? null : duration;
}

export function formatSleepDuration(minutes: number | null) {
  if (minutes === null) return "等待时间";
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}

export function formatCompactSleepDuration(minutes: number | null) {
  if (minutes === null) return "—";
  const roundedMinutes = Math.round(minutes);
  return `${Math.floor(roundedMinutes / 60)}h ${roundedMinutes % 60}m`;
}
