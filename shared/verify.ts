import { type DatasetProfile, type ParsedCsv } from "./stats";

const NUM_RE = /-?\d[\d,]*(?:\.\d+)?/g;

export function extractNumbers(text: string): number[] {
  const out: number[] = [];
  for (const m of text.match(NUM_RE) ?? []) {
    const n = Number(m.replace(/,/g, ""));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

const decimals = (raw: string) => (raw.split(".")[1] ?? "").length;

/**
 * Returns numbers stated in `text` that appear in none of the `allowedSources`
 * (profile JSON, tool results). Tolerates rounding to the precision the text uses.
 * Small whole numbers (<= 10, e.g. "top 3") are not checked.
 */
export function findUnverifiedNumbers(text: string, allowedSources: string[]): string[] {
  const allowed = allowedSources.flatMap(extractNumbers);
  const bad = new Set<string>();
  for (const raw of text.match(NUM_RE) ?? []) {
    const x = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(x)) continue;
    if (Number.isInteger(x) && Math.abs(x) <= 10) continue;
    const tol = 0.5 * 10 ** -decimals(raw) + 1e-9;
    if (!allowed.some((a) => Math.abs(a - x) <= tol)) bad.add(raw);
  }
  return [...bad];
}

/** Compact, privacy-preserving view of the data for the model: profile + 5 sample rows. */
export function buildModelContext(profile: DatasetProfile, parsed: ParsedCsv, name: string): string {
  const cols = profile.columnProfiles.map((c) => ({
    name: c.name,
    type: c.type,
    missing: c.missing,
    missingPct: c.missingPct,
    unique: c.unique,
    ...(c.numeric ? { numeric: c.numeric } : {}),
    ...(c.top ? { top: c.top.slice(0, 5) } : {}),
  }));
  return JSON.stringify({
    file: name,
    rows: profile.rows,
    columns: profile.columns,
    columnProfiles: cols,
    topCorrelations: profile.correlations.slice(0, 8),
    sampleRows: parsed.rows.slice(0, 5).map((r) => Object.fromEntries(parsed.headers.map((h, i) => [h, r[i] ?? ""]))),
  });
}
