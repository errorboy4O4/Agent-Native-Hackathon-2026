import Papa from "papaparse";

export const MAX_ROWS = 50_000;

export type ColType = "number" | "text" | "date";

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  truncated: boolean;
  totalRows: number;
}

export interface NumericSummary {
  min: number;
  max: number;
  mean: number;
  median: number;
  std: number;
}

export interface ColumnProfile {
  name: string;
  type: ColType;
  count: number; // non-missing
  missing: number;
  missingPct: number;
  unique: number;
  invalid: number; // non-conforming values in a typed column (mixed types)
  numeric?: NumericSummary;
  top?: { value: string; count: number }[];
}

export interface Correlation {
  a: string;
  b: string;
  r: number;
  n: number;
}

export interface DatasetProfile {
  rows: number;
  columns: number;
  truncated: boolean;
  totalRows: number;
  columnProfiles: ColumnProfile[];
  correlations: Correlation[];
}

const MISSING = new Set(["", "na", "n/a", "null", "nan", "none", "-"]);
export const isMissing = (v: string | undefined): boolean =>
  v === undefined || MISSING.has(v.trim().toLowerCase());

export function toNumber(v: string): number | null {
  const s = v.trim().replace(/,/g, "");
  if (s === "" || !/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/;
export const isDate = (v: string): boolean =>
  DATE_RE.test(v.trim()) && !Number.isNaN(Date.parse(v.trim()));

export function parseCsv(text: string): ParsedCsv {
  const res = Papa.parse<string[]>(text.replace(/^﻿/, ""), {
    skipEmptyLines: "greedy",
  });
  const all = res.data as string[][];
  if (all.length === 0) return { headers: [], rows: [], truncated: false, totalRows: 0 };
  const seen = new Map<string, number>();
  const headers = all[0]!.map((h, i) => {
    let name = (h ?? "").trim() || `column_${i + 1}`;
    const k = seen.get(name) ?? 0;
    seen.set(name, k + 1);
    if (k > 0) name = `${name}_${k + 1}`;
    return name;
  });
  const body = all.slice(1);
  const rows = body.slice(0, MAX_ROWS);
  return { headers, rows, truncated: body.length > MAX_ROWS, totalRows: body.length };
}

const round = (n: number, d = 4) => Number(n.toFixed(d));

function summarize(nums: number[]): NumericSummary {
  const sorted = [...nums].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, x) => s + x, 0) / n;
  const median = n % 2 ? sorted[(n - 1) / 2]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
  const variance = n > 1 ? sorted.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1) : 0;
  return {
    min: sorted[0]!,
    max: sorted[n - 1]!,
    mean: round(mean),
    median: round(median),
    std: round(Math.sqrt(variance)),
  };
}

export function inferType(values: string[]): { type: ColType; invalid: number } {
  const present = values.filter((v) => !isMissing(v));
  if (present.length === 0) return { type: "text", invalid: 0 };
  const numOk = present.filter((v) => toNumber(v) !== null).length;
  if (numOk / present.length >= 0.8) return { type: "number", invalid: present.length - numOk };
  const dateOk = present.filter(isDate).length;
  if (dateOk / present.length >= 0.9) return { type: "date", invalid: present.length - dateOk };
  return { type: "text", invalid: 0 };
}

export function columnValues(p: ParsedCsv, name: string): string[] {
  const i = p.headers.indexOf(name);
  if (i < 0) throw new Error(`Unknown column "${name}". Columns: ${p.headers.join(", ")}`);
  return p.rows.map((r) => r[i] ?? "");
}

export function numericValues(values: string[]): number[] {
  const out: number[] = [];
  for (const v of values) {
    if (isMissing(v)) continue;
    const n = toNumber(v);
    if (n !== null) out.push(n);
  }
  return out;
}

export function topValues(values: string[], k = 10) {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (isMissing(v)) continue;
    const key = v.trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, k)
    .map(([value, count]) => ({ value, count }));
}

export function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx, dy = ys[i]! - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export function pairedNumeric(p: ParsedCsv, a: string, b: string) {
  const ia = p.headers.indexOf(a), ib = p.headers.indexOf(b);
  if (ia < 0 || ib < 0) throw new Error(`Unknown column. Columns: ${p.headers.join(", ")}`);
  const xs: number[] = [], ys: number[] = [];
  for (const r of p.rows) {
    if (isMissing(r[ia]) || isMissing(r[ib])) continue;
    const x = toNumber(r[ia]!), y = toNumber(r[ib]!);
    if (x === null || y === null) continue;
    xs.push(x); ys.push(y);
  }
  return { xs, ys };
}

export function profileCsv(p: ParsedCsv): DatasetProfile {
  const columnProfiles: ColumnProfile[] = p.headers.map((name, i) => {
    const values = p.rows.map((r) => r[i] ?? "");
    const present = values.filter((v) => !isMissing(v));
    const { type, invalid } = inferType(values);
    const missing = values.length - present.length;
    const prof: ColumnProfile = {
      name,
      type,
      count: present.length,
      missing,
      missingPct: values.length ? round((missing / values.length) * 100, 2) : 0,
      unique: new Set(present.map((v) => v.trim())).size,
      invalid,
    };
    if (type === "number") {
      const nums = numericValues(values);
      if (nums.length) prof.numeric = summarize(nums);
    } else {
      prof.top = topValues(values);
    }
    return prof;
  });

  const numCols = columnProfiles.filter((c) => c.type === "number" && c.numeric).slice(0, 12);
  const correlations: Correlation[] = [];
  for (let i = 0; i < numCols.length; i++)
    for (let j = i + 1; j < numCols.length; j++) {
      const { xs, ys } = pairedNumeric(p, numCols[i]!.name, numCols[j]!.name);
      const r = pearson(xs, ys);
      if (r !== null) correlations.push({ a: numCols[i]!.name, b: numCols[j]!.name, r: round(r), n: xs.length });
    }
  correlations.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));

  return {
    rows: p.rows.length,
    columns: p.headers.length,
    truncated: p.truncated,
    totalRows: p.totalRows,
    columnProfiles,
    correlations,
  };
}

export interface Bin { label: string; from: number; to: number; count: number }

export function histogram(nums: number[], bins = 10): Bin[] {
  if (nums.length === 0) return [];
  const min = Math.min(...nums), max = Math.max(...nums);
  if (min === max) return [{ label: String(min), from: min, to: max, count: nums.length }];
  const w = (max - min) / bins;
  const out: Bin[] = Array.from({ length: bins }, (_, i) => ({
    label: `${round(min + i * w, 2)}–${round(min + (i + 1) * w, 2)}`,
    from: min + i * w,
    to: min + (i + 1) * w,
    count: 0,
  }));
  for (const x of nums) out[Math.min(bins - 1, Math.floor((x - min) / w))]!.count++;
  return out;
}

/** Deterministic even-stride sample so charts stay light and reproducible. */
export function samplePoints<T>(pts: T[], max = 500): T[] {
  if (pts.length <= max) return pts;
  const step = pts.length / max;
  return Array.from({ length: max }, (_, i) => pts[Math.floor(i * step)]!);
}

/** Sum a numeric column grouped by a categorical column (exact totals for Q&A). */
export function sumBy(p: ParsedCsv, groupCol: string, valueCol: string, k = 10) {
  const ig = p.headers.indexOf(groupCol), iv = p.headers.indexOf(valueCol);
  if (ig < 0 || iv < 0) throw new Error(`Unknown column. Columns: ${p.headers.join(", ")}`);
  const totals = new Map<string, { total: number; rows: number }>();
  for (const r of p.rows) {
    if (isMissing(r[ig])) continue;
    const v = toNumber(r[iv] ?? "");
    if (v === null) continue;
    const key = r[ig]!.trim();
    const cur = totals.get(key) ?? { total: 0, rows: 0 };
    cur.total += v; cur.rows++;
    totals.set(key, cur);
  }
  return [...totals.entries()]
    .map(([group, t]) => ({ group, total: round(t.total, 2), rows: t.rows }))
    .sort((a, b) => b.total - a.total)
    .slice(0, k);
}

/** Average of a numeric column per group, from unrounded values (4 decimals), highest first. */
export function meanBy(p: ParsedCsv, groupCol: string, valueCol: string, k = 10) {
  const ig = p.headers.indexOf(groupCol), iv = p.headers.indexOf(valueCol);
  if (ig < 0 || iv < 0) throw new Error(`Unknown column. Columns: ${p.headers.join(", ")}`);
  const acc = new Map<string, { sum: number; n: number }>();
  for (const r of p.rows) {
    if (isMissing(r[ig])) continue;
    const v = toNumber(r[iv] ?? "");
    if (v === null) continue;
    const key = r[ig]!.trim();
    const cur = acc.get(key) ?? { sum: 0, n: 0 };
    cur.sum += v; cur.n++;
    acc.set(key, cur);
  }
  return [...acc.entries()]
    .map(([group, t]) => ({ group, mean: round(t.sum / t.n), rows: t.n }))
    .sort((a, b) => b.mean - a.mean)
    .slice(0, k);
}
