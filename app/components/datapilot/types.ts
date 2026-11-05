export type ColumnProfile = {
  name: string;
  type: "number" | "text" | "date";
  count: number;
  missing: number;
  missingPct: number;
  unique: number;
  invalid: number;
  numeric?: { min: number; max: number; mean: number; median: number; std: number };
  top?: { value: string; count: number }[];
};

export type Chart = {
  id: string;
  kind: "histogram" | "bar" | "scatter";
  columns: string[];
  n: number;
  correlation?: number | null;
  data: { label?: string; count?: number; x?: number; y?: number }[];
};

export type Source = { label: string; data: unknown };
export type Answer = {
  id: string;
  question?: string;
  text: string;
  model: string;
  unverified: string[];
  sources: Source[];
};
export type Pin = { id: string; text: string; sources: string[] };

export type Dashboard =
  | { loaded: false }
  | {
      loaded: true;
      name: string;
      profile: {
        rows: number;
        columns: number;
        truncated: boolean;
        totalRows: number;
        columnProfiles: ColumnProfile[];
        correlations: { a: string; b: string; r: number; n: number }[];
      };
      charts: Chart[];
      pins: Pin[];
      summary: Answer | null;
      qa: Answer[];
    };
