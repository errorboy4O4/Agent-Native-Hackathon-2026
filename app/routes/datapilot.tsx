import "@fontsource-variable/schibsted-grotesk";
import "@/components/datapilot/datapilot.css";

import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { lazy, memo, Suspense, useCallback, useMemo, useRef, useState } from "react";

import type { Answer, Chart, ColumnProfile, Dashboard, Pin, Source } from "@/components/datapilot/types";

const ChartView = lazy(() => import("@/components/datapilot/ChartView"));

export function meta() {
  return [{ title: "DataPilot: drop in a CSV and ask it questions" }];
}

const MAX_FILE_BYTES = 6_000_000;
const SAMPLES = [
  { file: "retail.csv", title: "Online shop sales", note: "200 orders with date, product, category, quantity, price and country." },
  { file: "messy.csv", title: "Messy sign-ups", note: "7 people with blanks, a stray letter in a number column and a quoted comma." },
  { file: "iris.csv", title: "Iris flowers", note: "150 flowers with petal and sepal sizes for three species." },
];

type Loaded = Extract<Dashboard, { loaded: true }>;

/** Columns worth charting by default: skip identifiers, free text, and correlations from tiny samples. */
function pickColumns(cols: ColumnProfile[], rows: number, correlations: { a: string; b: string; n: number }[]) {
  const isId = (c: ColumnProfile) => /(^|_|\s)id$/i.test(c.name) || (c.unique === c.count && c.count > 1);
  const num = cols.find((c) => c.type === "number" && !isId(c));
  const cat = cols.find((c) => c.type === "text" && c.unique > 1 && c.unique <= 50 && c.unique <= rows / 2);
  const pair = correlations.find((r) => r.n >= 10 && cols.some((c) => c.name === r.a && !isId(c)) && cols.some((c) => c.name === r.b && !isId(c)));
  return { num, cat, pair };
}
const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export default function DataPilotRoute() {
  // Action hooks are typed from a generated registry; the cast keeps this file independent of it.
  const dash = useActionQuery("get_dashboard" as never, {} as never) as unknown as {
    data?: Dashboard;
    refetch: () => Promise<unknown>;
  };
  const run = (name: string) => useActionMutation(name as never) as unknown as { mutateAsync: (v: unknown) => Promise<any>; isPending: boolean };
  const profile = run("profile_dataset");
  const plot = run("plot_column");
  const compare = run("compare_columns");
  const remove = run("remove_chart");
  const pin = run("pin_finding");
  const summarize = run("summarize_findings");
  const ask = run("answer_question");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { refetch } = dash;
  const refresh = useCallback(() => refetch(), [refetch]);
  const guard = useCallback(
    async (fn: () => Promise<unknown>, fallback: string) => {
      setError(null);
      try {
        await fn();
        await refresh();
      } catch (e) {
        setError(errText(e, fallback));
      }
    },
    [refresh],
  );

  const load = async (name: string, csv: string) => {
    setError(null);
    setBusy(true);
    try {
      const res = (await profile.mutateAsync({ name, csv })) as {
        profile: { rows: number; columnProfiles: ColumnProfile[]; correlations: { a: string; b: string; n: number }[] };
      };
      // Starter charts use the same actions the agent calls.
      const { num, cat, pair: top } = pickColumns(res.profile.columnProfiles, res.profile.rows, res.profile.correlations);
      if (num) await plot.mutateAsync({ column: num.name });
      if (cat) await plot.mutateAsync({ column: cat.name });
      if (top) await compare.mutateAsync({ x: top.a, y: top.b });
      await refresh();
      setPicking(false);
    } catch (e) {
      setError(errText(e, "That file couldn’t be read. Check it is a CSV with a header row."));
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError(`That file is ${(file.size / 1e6).toFixed(1)} MB. DataPilot handles files up to ${MAX_FILE_BYTES / 1e6} MB (about 50,000 rows). Trim it and try again.`);
      return;
    }
    await load(file.name, await file.text());
  };

  const loadSample = async (file: string) => {
    const res = await fetch(`/samples/${file}`);
    if (!res.ok) return setError("The sample file couldn’t be loaded. Reload the page and try again.");
    await load(file, await res.text());
  };

  const d = dash.data;
  const loaded = d?.loaded ? d : null;

  const actions = useMemo(
    () => ({
      swap: (c: Chart, column: string) => guard(() => plot.mutateAsync({ column, chartId: c.id }), "That chart couldn’t be changed."),
      swapScatter: (c: Chart, x: string, y: string) => guard(() => compare.mutateAsync({ x, y, chartId: c.id }), "That chart couldn’t be changed."),
      add: (column: string) => guard(() => plot.mutateAsync({ column }), "That chart couldn’t be added."),
      addScatter: (x: string, y: string) => guard(() => compare.mutateAsync({ x, y }), "That chart couldn’t be added."),
      remove: (id: string) => guard(() => remove.mutateAsync({ chartId: id }), "That chart couldn’t be removed."),
      unpin: (id: string) => guard(() => pin.mutateAsync({ unpinId: id }), "That pin couldn’t be removed."),
      pinAnswer: (a: Answer) =>
        guard(
          () =>
            pin.mutateAsync({
              text: a.text.slice(0, 600),
              sources: a.sources.slice(0, 8).map((s) => `${s.label}: ${JSON.stringify(s.data)}`.slice(0, 190)),
            }),
          "That answer couldn’t be pinned.",
        ),
      summarize: () => guard(() => summarize.mutateAsync({}), "The summary couldn’t be written."),
      ask: (question: string) => guard(() => ask.mutateAsync({ question }), "That question couldn’t be answered."),
    }),
    // mutation objects are stable per hook; guard is stable per refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [guard],
  );

  return (
    <div className="dp">
      <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      <div className="mx-auto max-w-[1040px] px-6 pb-20 pt-8">
        <header className="mb-10 flex flex-wrap items-baseline justify-between gap-3">
          <span className="text-[15px] font-bold tracking-tight">DataPilot</span>
          {loaded && !picking && (
            <button
              className="btn"
              disabled={busy}
              onClick={() => {
                const hasWork = loaded.pins.length > 0 || loaded.qa.length > 0 || loaded.summary;
                if (!hasWork || window.confirm("Opening a new file clears this file’s charts, answers and pins. Continue?")) setPicking(true);
              }}
            >
              Open a different file
            </button>
          )}
        </header>

        {error && (
          <div role="alert" className="alert mb-6">
            {error}
          </div>
        )}

        {loaded && !picking ? (
          <Workspace d={loaded} actions={actions} summarizing={summarize.isPending} asking={ask.isPending} />
        ) : (
          <Intake busy={busy} onCancel={loaded ? () => setPicking(false) : undefined} onPick={() => fileRef.current?.click()} onSample={loadSample} onDrop={onFile} />
        )}

        <footer className="rule mt-16 pt-4 text-[13px] muted">
          The model never sees your whole file. It gets column statistics, five sample rows, and the results of exact calculations it asks for.
        </footer>
      </div>
    </div>
  );
}

function Intake(props: {
  busy: boolean;
  onCancel: (() => void) | undefined;
  onPick: () => void;
  onSample: (f: string) => void;
  onDrop: (f: File | undefined) => void;
}) {
  return (
    <section aria-labelledby="intake-h">
      <h1 id="intake-h" className="max-w-[18ch] text-[44px] font-bold">
        Drop in a CSV and ask it questions.
      </h1>
      <p className="mt-4 max-w-[56ch] text-[18px] muted">
        DataPilot reads every row, draws the charts, and answers in plain English. The maths is done in code, so the numbers are exact.
      </p>
      <div
        className="graticule mt-10 border border-dashed border-[var(--ink)] px-6 py-14"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          props.onDrop(e.dataTransfer.files[0]);
        }}
      >
        <p className="text-[20px] font-semibold" aria-live="polite">
          {props.busy ? "Reading your file…" : "Drag a CSV here"}
        </p>
        <p className="mt-1 text-[14px] muted">Up to 6 MB, about 50,000 rows.</p>
        <button className="btn btn-solid mt-5" disabled={props.busy} onClick={props.onPick}>
          Choose a file
        </button>
      </div>
      {props.onCancel && (
        <button className="btn mt-6" onClick={props.onCancel}>
          Keep the current file
        </button>
      )}
      <h2 className="mb-3 mt-10 text-[18px] font-semibold">No file handy? Try one of these.</h2>
      <ul className="grid gap-3 sm:grid-cols-3">
        {SAMPLES.map((s) => (
          <li key={s.file}>
            <button className="chip w-full" style={{ borderRadius: 8 }} disabled={props.busy} onClick={() => props.onSample(s.file)}>
              <span className="block font-semibold">{s.title}</span>
              <span className="block text-[13px] muted">{s.note}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

type Actions = {
  swap: (c: Chart, col: string) => void;
  swapScatter: (c: Chart, x: string, y: string) => void;
  add: (col: string) => void;
  addScatter: (x: string, y: string) => void;
  remove: (id: string) => void;
  unpin: (id: string) => void;
  pinAnswer: (a: Answer) => void;
  summarize: () => void;
  ask: (q: string) => void;
};

function Workspace({ d, actions, summarizing, asking }: { d: Loaded; actions: Actions; summarizing: boolean; asking: boolean }) {
  const cols = d.profile.columnProfiles;
  const emptyCells = useMemo(() => cols.reduce((s, c) => s + c.missing, 0), [cols]);
  return (
    <>
      <section aria-labelledby="file-h">
        <h1 id="file-h" translate="no" className="break-words text-[34px] font-bold">
          {d.name}
        </h1>
        <p className="mt-2 text-[18px] muted">
          {d.profile.rows.toLocaleString()} rows across {d.profile.columns} columns.{" "}
          {emptyCells === 0 ? "No cells are empty." : `${emptyCells.toLocaleString()} cells are empty.`}
        </p>
        {d.profile.truncated && (
          <p className="flag mt-3">
            Only the first {d.profile.rows.toLocaleString()} of {d.profile.totalRows.toLocaleString()} rows were analysed. That is the demo limit.
          </p>
        )}
      </section>

      <AskPanel d={d} actions={actions} asking={asking} />
      <SummaryBlock d={d} actions={actions} pending={summarizing} />
      <ChartsSection d={d} actions={actions} />
      <ColumnIndex cols={cols} />
      <PinnedList pins={d.pins} onUnpin={actions.unpin} />
    </>
  );
}

function suggestions(cols: ColumnProfile[], rows: number, correlations: { a: string; b: string; n: number }[]): string[] {
  const { num, cat, pair } = pickColumns(cols, rows, correlations);
  const out: string[] = [];
  if (cat && num) out.push(`Which ${cat.name} has the highest total ${num.name}?`);
  if (pair) out.push("What is the strongest relationship between the number columns?");
  out.push("Is anything missing or odd in this data?");
  return out;
}

function AskPanel({ d, actions, asking }: { d: Loaded; actions: Actions; asking: boolean }) {
  const [q, setQ] = useState("");
  const chips = useMemo(
    () => suggestions(d.profile.columnProfiles, d.profile.rows, d.profile.correlations),
    [d.profile.columnProfiles, d.profile.rows, d.profile.correlations],
  );
  const [latest, ...earlier] = d.qa;
  const submit = (text: string) => {
    const t = text.trim();
    if (t.length < 3 || asking) return;
    setQ("");
    actions.ask(t);
  };
  return (
    <section aria-labelledby="ask-h" className="rule mt-10 pt-6">
      <h2 id="ask-h" className="text-[24px] font-bold">
        Ask about this data
      </h2>
      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(q);
        }}
      >
        <label htmlFor="dp-question" className="sr-only">
          Your question
        </label>
        <input
          id="dp-question"
          name="question"
          className="field min-w-[240px] flex-1 text-[16px]"
          style={{ minHeight: 44 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="For example: which category sells the most…"
          autoComplete="off"
          maxLength={500}
        />
        <button className="btn btn-solid" style={{ minHeight: 44 }} disabled={asking || q.trim().length < 3}>
          {asking ? "Working it out…" : "Ask"}
        </button>
      </form>
      <ul className="mt-3 flex flex-wrap gap-2">
        {chips.map((c) => (
          <li key={c}>
            <button className="chip" disabled={asking} onClick={() => submit(c)}>
              {c}
            </button>
          </li>
        ))}
      </ul>

      <div aria-live="polite" className="mt-6">
        {latest && <AnswerView a={latest} onPin={() => actions.pinAnswer(latest)} big />}
      </div>
      {earlier.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-[14px] font-semibold">Earlier questions ({earlier.length})</summary>
          <div className="mt-4 space-y-8">
            {earlier.map((a) => (
              <AnswerView key={a.id} a={a} onPin={() => actions.pinAnswer(a)} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function Prose({ text, big }: { text: string; big?: boolean | undefined }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const bullet = (l: string) => /^[*-]\s+/.test(l);
  const size = big ? "text-[22px] leading-snug" : "text-[16px]";
  return (
    <div className={`${size} space-y-2`}>
      {lines.map((l, i) =>
        bullet(l) ? (
          <p key={i} className="ml-5 list-item list-disc">
            {l.replace(/^[*-]\s+/, "").replace(/\*\*|`/g, "")}
          </p>
        ) : (
          <p key={i}>{l.replace(/\*\*|`/g, "")}</p>
        ),
      )}
    </div>
  );
}

const AnswerView = memo(function AnswerView({ a, onPin, big }: { a: Answer; onPin: () => void; big?: boolean }) {
  return (
    <article className={big ? "answer-in" : ""}>
      {a.question && <p className="mb-2 text-[14px] font-semibold muted">You asked: {a.question}</p>}
      <Prose text={a.text} big={big} />
      {a.unverified.length > 0 && (
        <p className="flag mt-3">
          These figures weren’t found in the computed results: {a.unverified.join(", ")}. Check them before you rely on them.
        </p>
      )}
      {a.sources.length > 0 && <Ledger sources={a.sources} />}
      <div className="mt-3 flex items-center gap-4">
        <button className="btn" onClick={onPin}>
          Pin this answer
        </button>
        <span className="text-[13px] muted">Written by {a.model}. Numbers computed in code.</span>
      </div>
    </article>
  );
});

function Ledger({ sources }: { sources: Source[] }) {
  return (
    <div className="mt-4 border-l-4 border-[var(--blue)] pl-4">
      <h3 className="text-[14px] font-semibold">Where the numbers come from</h3>
      {sources.map((s, i) => (
        <div key={i} className="mt-2">
          <p className="text-[13px] muted">{s.label}</p>
          <table>
            <tbody>
              {(Array.isArray(s.data) ? s.data.slice(0, 8) : [s.data]).map((row, j) => (
                <tr key={j}>
                  {row && typeof row === "object" ? (
                    Object.entries(row as Record<string, unknown>).map(([k, v]) => (
                      <td key={k}>
                        <span className="muted">{k} </span>
                        {String(v)}
                      </td>
                    ))
                  ) : (
                    <td>{String(row)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function SummaryBlock({ d, actions, pending }: { d: Loaded; actions: Actions; pending: boolean }) {
  return (
    <section aria-labelledby="sum-h" className="rule mt-10 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="sum-h" className="text-[24px] font-bold">
          The short version
        </h2>
        <button className="btn" onClick={actions.summarize} disabled={pending}>
          {pending ? "Writing…" : d.summary ? "Write it again" : "Summarize this data"}
        </button>
      </div>
      <div aria-live="polite" className="mt-4">
        {d.summary ? (
          <AnswerView a={d.summary} onPin={() => actions.pinAnswer(d.summary!)} />
        ) : (
          <p className="muted">Get a few plain-English findings, including anything missing or odd.</p>
        )}
      </div>
    </section>
  );
}

function ChartsSection({ d, actions }: { d: Loaded; actions: Actions }) {
  const cols = d.profile.columnProfiles;
  const numCols = useMemo(() => cols.filter((c) => c.type === "number").map((c) => c.name), [cols]);
  const [addCol, setAddCol] = useState("");
  const [sx, setSx] = useState("");
  const [sy, setSy] = useState("");
  return (
    <section aria-labelledby="charts-h" className="rule mt-10 pt-6">
      <h2 id="charts-h" className="text-[24px] font-bold">
        Charts
      </h2>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="dp-add-col">Column to chart</label>
        <select id="dp-add-col" className="field" value={addCol} onChange={(e) => setAddCol(e.target.value)}>
          <option value="">Pick a column</option>
          {cols.map((c) => (
            <option key={c.name}>{c.name}</option>
          ))}
        </select>
        <button className="btn" disabled={!addCol} onClick={() => { actions.add(addCol); setAddCol(""); }}>
          Add chart
        </button>
        {numCols.length >= 2 && (
          <>
            <span className="mx-2 muted" aria-hidden="true">|</span>
            <label className="sr-only" htmlFor="dp-sx">Scatter x column</label>
            <select id="dp-sx" className="field" value={sx} onChange={(e) => setSx(e.target.value)}>
              <option value="">Across</option>
              {numCols.map((n) => <option key={n}>{n}</option>)}
            </select>
            <label className="sr-only" htmlFor="dp-sy">Scatter y column</label>
            <select id="dp-sy" className="field" value={sy} onChange={(e) => setSy(e.target.value)}>
              <option value="">Up</option>
              {numCols.map((n) => <option key={n}>{n}</option>)}
            </select>
            <button className="btn" disabled={!sx || !sy || sx === sy} onClick={() => { actions.addScatter(sx, sy); setSx(""); setSy(""); }}>
              Compare two columns
            </button>
          </>
        )}
      </div>
      <div className="mt-6 grid gap-x-8 gap-y-10 md:grid-cols-2">
        {d.charts.map((c) => (
          <ChartCard key={c.id} c={c} cols={cols} numCols={numCols} actions={actions} />
        ))}
      </div>
      {d.charts.length === 0 && <p className="mt-4 muted">No charts yet. Pick a column above, or ask the agent to chart one.</p>}
    </section>
  );
}

const ChartCard = memo(function ChartCard({ c, cols, numCols, actions }: { c: Chart; cols: ColumnProfile[]; numCols: string[]; actions: Actions }) {
  const title =
    c.kind === "scatter" ? `${c.columns[1]} against ${c.columns[0]}` : c.kind === "histogram" ? `How ${c.columns[0]} is spread` : `Most common ${c.columns[0]}`;
  return (
    <figure>
      <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[16px] font-semibold">{title}</h3>
        <span className="flex items-center gap-2">
          {c.kind === "scatter" ? (
            <>
              <select className="field" aria-label="Across column" value={c.columns[0]} onChange={(e) => actions.swapScatter(c, e.target.value, c.columns[1]!)}>
                {numCols.map((n) => <option key={n}>{n}</option>)}
              </select>
              <select className="field" aria-label="Up column" value={c.columns[1]} onChange={(e) => actions.swapScatter(c, c.columns[0]!, e.target.value)}>
                {numCols.map((n) => <option key={n}>{n}</option>)}
              </select>
            </>
          ) : (
            <select className="field" aria-label="Chart column" value={c.columns[0]} onChange={(e) => actions.swap(c, e.target.value)}>
              {cols.map((x) => <option key={x.name}>{x.name}</option>)}
            </select>
          )}
          <button className="btn" onClick={() => actions.remove(c.id)} aria-label={`Remove chart: ${title}`}>
            Remove
          </button>
        </span>
      </figcaption>
      <div className="graticule h-60 border border-[var(--rule)] bg-white/60 p-1">
        <Suspense fallback={<p className="p-4 text-[14px] muted">Loading chart…</p>}>
          <ChartView chart={c} />
        </Suspense>
      </div>
      <p className="mt-1 text-[13px] muted">
        Based on {c.n.toLocaleString()} rows.
        {c.kind === "scatter" && c.correlation != null && ` Correlation: ${c.correlation}.`}
        {c.kind === "scatter" && c.data.length < c.n && ` Showing a sample of ${c.data.length} points.`}
      </p>
    </figure>
  );
});

function ColumnIndex({ cols }: { cols: ColumnProfile[] }) {
  return (
    <section aria-labelledby="cols-h" className="rule mt-10 pt-6">
      <h2 id="cols-h" className="text-[24px] font-bold">
        Every column
      </h2>
      <div className="mt-4 overflow-x-auto">
        <table>
          <caption className="sr-only">Type, empty cells, distinct values and summary for each column</caption>
          <thead>
            <tr>
              <th scope="col">Column</th>
              <th scope="col">Holds</th>
              <th scope="col">Empty</th>
              <th scope="col">Distinct</th>
              <th scope="col">What is in it</th>
            </tr>
          </thead>
          <tbody>
            {cols.map((c) => (
              <tr key={c.name}>
                <th scope="row" translate="no" className="font-semibold" style={{ color: "var(--ink)", borderBottom: "1px solid var(--rule)" }}>{c.name}</th>
                <td>{c.type === "number" ? "numbers" : c.type === "date" ? "dates" : "text"}</td>
                <td>{c.missing} ({c.missingPct}%)</td>
                <td>{c.unique}</td>
                <td>
                  {c.numeric
                    ? `From ${c.numeric.min} to ${c.numeric.max}, middle value ${c.numeric.median}, average ${c.numeric.mean}.`
                    : c.top?.slice(0, 3).map((t) => `${t.value} (${t.count})`).join(", ")}
                  {c.invalid > 0 && ` ${c.invalid} value${c.invalid === 1 ? " doesn’t" : "s don’t"} fit.`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PinnedList({ pins, onUnpin }: { pins: Pin[]; onUnpin: (id: string) => void }) {
  return (
    <section aria-labelledby="pins-h" className="rule mt-10 pt-6">
      <h2 id="pins-h" className="text-[24px] font-bold">
        Pinned
      </h2>
      {pins.length === 0 ? (
        <p className="mt-3 muted">Pin an answer to keep it here, with the numbers behind it.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {pins.map((p) => (
            <li key={p.id} className="border-l-4 border-[var(--amber)] pl-4">
              <p>{p.text}</p>
              {p.sources.length > 0 && <p className="mt-1 break-words text-[13px] muted">From: {p.sources.join("; ")}</p>}
              <button className="btn mt-2" onClick={() => onUnpin(p.id)}>
                Unpin
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
