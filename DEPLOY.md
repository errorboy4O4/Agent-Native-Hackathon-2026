# Deploying DataPilot to Vercel

Status: the production build passes locally (`pnpm build`). A live deployment still needs three things only you can supply.

1. **A Vercel login.** Run `npx vercel login` in this folder.
2. **A Postgres database.** Production cannot use the local PGlite file. Create a free Neon (or Supabase) database and copy its connection string.
3. **A decision about login.** Agent-Native apps ship with accounts. Visitors to a deployed copy will hit a sign-up wall. The only documented way to remove it is `AUTH_DISABLED=true`, which the docs say is for demos and previews only: every visitor then shares one user and one dataset. It would also let anyone spend your Gemini free-tier quota. The submission does not require a live URL (the public Clips video is the required demo), so leaving it behind a login, or skipping deployment, is a reasonable choice.

## Steps (from the Agent-Native deployment docs)

```bash
npx vercel login
npx vercel link
```

Set the environment variables in Vercel (Project, Settings, Environment Variables), never in code:

| Name | Value |
|---|---|
| `DATABASE_URL` | your Postgres connection string |
| `BETTER_AUTH_SECRET` | 32+ random characters (`openssl rand -hex 32`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | your Gemini key |
| `DATAPILOT_MODELS` | optional, e.g. `gemini-3.8-flash,gemini-3.5-flash,gemini-3.1-flash-lite` |

Then, with `DATABASE_URL` exported in your shell:

```bash
pnpm migrate:production
NITRO_PRESET=vercel pnpm build
npx vercel deploy --prebuilt --prod
```

Open the URL in a private window to confirm it works with no local state.

Data note: the uploaded CSV is stored as text in the app database (up to about 6 MB). On a shared deployment treat it as visible to the app's owner.

## Windows notes (learned deploying on Nov 6)
Building on Windows with `NITRO_PRESET=vercel` produces output that Vercel rejects until you patch two things in `.vercel/output` (generated, gitignored):
1. `functions/[...page].func` and `functions/index.func` are symlinks to an absolute local path. Replace each with a real copy of `functions/__server.func`.
2. `config.json` registers a cron with `* * * * *`, which the Hobby plan rejects. Change `schedule` to `0 9 * * *`.
Then run `npx vercel deploy --prebuilt --prod --yes`. Building on Linux (or Vercel's own build) avoids both.
