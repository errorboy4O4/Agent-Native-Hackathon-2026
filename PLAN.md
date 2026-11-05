# DataPilot plan

Concept: drop a CSV; agent profiles, charts, answers questions. All stats deterministic in TS; LLM only narrates, using computed numbers.

Concept builds on the founder's earlier ChatEDA (Flip the Switch, Nov 4); this is a new implementation in Agent-Native, built Nov 5-9. No code copied.

## Architecture
- `lib/csv/` pure TS: parse (PapaParse), type inference, profile, histogram/top-N/correlation. Unit-tested with vitest.
- Dataset state: parsed rows kept server-side keyed by dataset id (in-memory + application_state for UI/agent-shared state: current dataset, chart specs, pinned findings).
- `actions/`: `profile_dataset`, `plot_column`, `compare_columns`, `summarize_findings`, `answer_question` via `defineAction`. UI calls the same actions via hooks; the agent calls them as tools.
- UI route `app/routes/datapilot.tsx` (single screen): dropzone + sample buttons, Profile Card, Chart Gallery (column selector, pin), chat panel via the template's agent chat.
- Charts: Recharts (check what template already has; add only one lib).
- Privacy: only profile + small samples reach the model.

## Tasks
- M1 scaffold/recon: done once the app renders.
- M2 stats lib + `profile_dataset` + upload UI + 2 sample CSVs.
- M3 `plot_column`, `compare_columns`, chart gallery; end-to-end on both samples.
- M4 (Nov 9) `summarize_findings`, `answer_question`, Gemini/Claude wiring.
- M5-M7 (Nov 9) polish, deploy to Vercel, Clips demo, submit by 6 PM IST.
- No work Nov 6-8.
