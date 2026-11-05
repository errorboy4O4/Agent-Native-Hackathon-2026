# Recon notes (2026-11-05)

Sources: agent-native.com/docs (getting started, actions-defining, environment-variables, key-concepts, template-chat, template-chat-developers).

## Setup facts
- Node >= 22.22, pnpm. Scaffold: `npx --yes @agent-native/core@latest create datapilot --standalone --template chat`.
- **Windows gotcha:** the project path must NOT contain spaces (`pnpm dev` / `typecheck` shell out and break on `D:\AgentNative Hackathon`). Repo lives at `D:\AgentNativeHackathon\datapilot`.
- Local dev: Welcome screen -> "Continue as local dev" (no login).
- Local DB: PGlite (Postgres via Drizzle). `server/db/schema.ts` does not exist until we add it.

## Key patterns
- `actions/<name>.ts` default-exports `defineAction({ description, schema (zod), http?, run })` from `@agent-native/core/action`. Files are auto-discovered; filename = action name.
- One action = agent tool + typed React hook (`useActionQuery` / `useActionMutation` from `@agent-native/core/client/hooks`) + HTTP endpoint (`/_agent-native/actions/<name>`) + CLI (`pnpm action <name>`). **This is the "shared action" story for the demo.**
- Errors: `fail(msg, { errorCode, statusCode })`; never return `{ error }`.
- Mutating agent actions auto-invalidate action-backed queries, so UI updates live.
- UI never calls the LLM directly; use `sendToAgentChat({ message, context, submit: true })` from `@agent-native/core/client/agent-chat`.
- Ephemeral UI state lives in `application_state`; the agent reads it with the `view-screen` action.
- Template files: `actions/` (hello, navigate, view-screen), `server/plugins/agent-chat.ts` (system prompt, INITIAL_TOOL_NAMES), `app/routes/*.tsx` (flatRoutes), `app/components/chat/ChatRouteContent.tsx`.

## LLM provider (BYOK)
- Env vars in `.env` (gitignored): `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` (Gemini), `OPENROUTER_API_KEY`. Engine picked via `AGENT_ENGINE` or Settings. Never use `VITE_` prefix for keys.
- Gemini is documented as a fallback key; exact engine name for `AGENT_ENGINE` still to confirm (M4).
- No key is hardcoded; `.env*` is gitignored except `.env.example`.

## Dev gotchas
- After adding/renaming files in `actions/`, hot-restart can fail on a PGlite lock ("Failed to restart after an action registry change"); the new action then falls through to a shell runner ("command line is too long"). Fix: stop and restart the dev server.
- App state (dataset, charts, pins) persists in the local PGlite DB across restarts.

## Status (Nov 5, end of day)
- M1-M4 done and checked in the browser: stats lib, 8 actions (profile_dataset, plot_column, compare_columns, get_dashboard, remove_chart, pin_finding, sum_by, summarize_findings, answer_question), UI at `/datapilot` (also `/`), 16 vitest tests, production build passes.
- LLM: Gemini via Vercel AI SDK. `gemini-2.5-flash` is closed to new keys; `gemini-3.8-flash` was overloaded during testing, so `server/lib/llm.ts` falls back to `gemini-3.5-flash` then `gemini-3.1-flash-lite` (override with DATAPILOT_MODELS). The model only calls exact tools; numbers it states are checked against the profile and tool results (`shared/verify.ts`).
- Skills installed: frontend-design, web-design-guidelines, vercel-react-best-practices (note the real name; `react-best-practices` does not exist).
- Decision (Nov 5): live deployment deferred. The owner will sign in to Vercel and deploy after everything else is done, then tell Claude (needs DATABASE_URL and an auth decision: see DEPLOY.md). Not done: Clips recording and form submission (see DEMO.md, SUBMISSION.md). The template's right-hand agent chat sidebar is untouched and its engine is not configured for Gemini.
