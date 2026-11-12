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
