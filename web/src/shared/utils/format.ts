export function formatCount(value: number): string {
  if (value >= 1_000_000) {
    return `${trim(value / 1_000_000)}M`;
  }
  if (value >= 1_000) {
    return `${trim(value / 1_000)}K`;
  }
  return String(value);
}

function trim(value: number): string {
  return value.toFixed(1).replace(/\.0$/u, '');
}

const RELATIVE_UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/** "2 days ago" style label; returns an empty string for missing or invalid dates. */
export function formatRelativeTime(iso: string | undefined, now: number = Date.now()): string {
  const time = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(time)) {
    return '';
  }
  const seconds = Math.max(0, Math.round((now - time) / 1000));
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'always' });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (seconds >= size) {
      return formatter.format(-Math.floor(seconds / size), unit);
    }
  }
  return 'just now';
}
