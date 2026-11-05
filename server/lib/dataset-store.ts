import { readAppState, writeAppState } from "@agent-native/core/application-state";
import {
  type ParsedCsv, type DatasetProfile, columnValues, histogram, inferType, numericValues,
  pairedNumeric, parseCsv, pearson, profileCsv, samplePoints, topValues,
} from "../../shared/stats";

export interface ChartSpec {
  id: string;
  kind: "histogram" | "bar" | "scatter";
  columns: string[]; // [col] or [x, y]
}
export interface Finding { id: string; text: string; sources: string[] }
export interface Answer {
  id: string; question?: string; text: string; model: string; unverified: string[];
  sources: { label: string; data: unknown }[];
}
interface UiState { charts: ChartSpec[]; pins: Finding[]; summary: Answer | null; qa: Answer[] }

const DATA_KEY = "dp-dataset";
const UI_KEY = "dp-ui";
export const MAX_CSV_CHARS = 8_000_000;
export const MAX_CHARTS = 12;

export async function saveDataset(name: string, csv: string) {
  await writeAppState(DATA_KEY, { name, csv });
  await writeAppState(UI_KEY, { charts: [], pins: [], summary: null, qa: [] });
}

// Parse once per distinct CSV: a 50k-row file otherwise re-parses on every action call.
let cache: { key: string; parsed: ParsedCsv } | null = null;
const profiles = new WeakMap<ParsedCsv, DatasetProfile>();

export function profileOf(parsed: ParsedCsv): DatasetProfile {
  let p = profiles.get(parsed);
  if (!p) profiles.set(parsed, (p = profileCsv(parsed)));
  return p;
}

export async function loadDataset(): Promise<{ name: string; parsed: ParsedCsv }> {
  const s = await readAppState(DATA_KEY);
  if (!s || typeof s.csv !== "string") {
    throw new Error("No dataset loaded. Call profile_dataset with a CSV first (or ask the user to load a sample / upload a file).");
  }
  const key = `${s.csv.length}:${s.csv.slice(0, 200)}:${s.csv.slice(-200)}`;
  if (cache?.key !== key) cache = { key, parsed: parseCsv(s.csv) };
  return { name: String(s.name ?? "dataset"), parsed: cache.parsed };
}

export async function loadUi(): Promise<UiState> {
  const s = (await readAppState(UI_KEY)) as Partial<UiState> | null;
  return { charts: s?.charts ?? [], pins: s?.pins ?? [], summary: s?.summary ?? null, qa: s?.qa ?? [] };
}
export const saveUi = (ui: UiState) => writeAppState(UI_KEY, ui as unknown as Record<string, unknown>);

export function requireColumn(p: ParsedCsv, name: string) {
  if (!p.headers.includes(name)) throw new Error(`Unknown column "${name}". Available: ${p.headers.join(", ")}`);
}

export function chartKey(c: Pick<ChartSpec, "kind" | "columns">) {
  return `${c.kind}:${c.columns.join("|")}`;
}

/** Computes chart data + the exact numbers behind it. Pure given parsed CSV. */
export function renderChart(p: ParsedCsv, c: ChartSpec) {
  if (c.kind === "histogram") {
    const nums = numericValues(columnValues(p, c.columns[0]!));
    return { ...c, n: nums.length, data: histogram(nums, 10).map((b) => ({ label: b.label, count: b.count })) };
  }
  if (c.kind === "bar") {
    const values = columnValues(p, c.columns[0]!);
    return { ...c, n: values.length, data: topValues(values, 10).map((t) => ({ label: t.value, count: t.count })) };
  }
  const { xs, ys } = pairedNumeric(p, c.columns[0]!, c.columns[1]!);
  const r = pearson(xs, ys);
  const pts = xs.map((x, i) => ({ x, y: ys[i] }));
  return { ...c, n: xs.length, correlation: r === null ? null : Number(r.toFixed(4)), data: samplePoints(pts, 500) };
}

export function colType(p: ParsedCsv, name: string) {
  return inferType(columnValues(p, name)).type;
}

export type { DatasetProfile };
export { profileCsv };
