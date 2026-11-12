import { UAParser } from 'ua-parser-js';

/** Human-readable device name for the devices list, e.g. "Chrome on Windows". */
export function deviceLabel(userAgent: string) {
  if (!userAgent) return 'Unknown device';
  const { browser, os } = UAParser(userAgent);
  if (browser.name && os.name) return `${browser.name} on ${os.name}`;
  return browser.name ?? os.name ?? 'Unknown device';
}
