// Sleep token parser and utilities for sequence execution

export function getSleepMs(raw: unknown): number | null {
  const s = String(raw ?? '').trim();
  
  // sleep 5 or sleep5 -> 5000ms
  let m = s.match(/^sleep\s*([0-9]+)$/i) || s.match(/^sleep([0-9]+)$/i);
  if (m) return +m[1] * 1000;
  
  // sleep,5000 -> 5000ms
  m = s.match(/^sleep\s*,\s*([0-9]+)$/i);
  if (m) return +m[1];
  
  // delay 500 ms or delay 5 s
  m = s.match(/^delay\s*([0-9]+)\s*(ms|s)?$/i);
  if (m) return (m[2]?.toLowerCase() === 's') ? +m[1] * 1000 : +m[1];
  
  // wait/pause/hold 500 ms or wait 5 s  
  m = s.match(/^(wait|pause|hold)\s*([0-9]+)\s*(ms|s)?$/i);
  if (m) return (m[3]?.toLowerCase() === 's') ? +m[2] * 1000 : +m[2];
  
  return null;
}

export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));