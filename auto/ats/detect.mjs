/**
 * URL → ATS adapter routing.
 */
import { AshbyAdapter } from './ashby.mjs';
import { GreenhouseAdapter } from './greenhouse.mjs';
import { LeverAdapter } from './lever.mjs';

const PATTERNS = [
  { re: /jobs\.ashbyhq\.com\//i, type: 'ashby', Cls: AshbyAdapter },
  { re: /(?:job-boards|boards)(?:\.eu)?\.greenhouse\.io\//i, type: 'greenhouse', Cls: GreenhouseAdapter },
  { re: /jobs\.lever\.co\//i, type: 'lever', Cls: LeverAdapter },
];

export function detectAts(url) {
  for (const p of PATTERNS) {
    if (p.re.test(url)) return p;
  }
  return null;
}

export function buildAdapter(url, ctx) {
  const d = detectAts(url);
  if (!d) throw new Error(`No ATS adapter for URL: ${url}\nSupported: Ashby, Greenhouse, Lever`);
  return new d.Cls(url, ctx);
}
