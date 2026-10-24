# DR Politicians

Source-backed profiles of living current and former politicians of the Dominican
Republic. Public site in Spanish plus an admin backoffice. Scope, architecture and
roadmap: [docs/PLAN.md](docs/PLAN.md).

## Requirements

- Node.js 22.12+ (24 recommended) and pnpm (version pinned in `package.json`)
- Docker with Compose v2 (local Postgres)

## Setup

```bash
pnpm install
cp .env.example .env.local   # then fill in BETTER_AUTH_SECRET (openssl rand -base64 32)
pnpm db:up                   # start Postgres on 127.0.0.1:54329 and wait until healthy
pnpm db:migrate
pnpm db:seed                 # provinces, municipalities, parties, institutions
pnpm dev
```

Google sign-in and Resend email are optional in development. Without
`RESEND_API_KEY`, emails (verification, password reset) are printed to the dev
server log, or written as JSON files to `MAIL_OUTBOX_DIR` when it is set.

## Commands

| Command                                              | What it does                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start`             | Next.js dev server, production build, production server                                                             |
| `pnpm lint` / `pnpm typecheck` / `pnpm format:check` | Static checks (CI runs all three)                                                                                   |
| `pnpm test`                                          | Unit tests and database integration tests (needs `pnpm db:up`; uses `TEST_DATABASE_URL`, which must end in `_test`) |
| `pnpm e2e`                                           | Playwright end-to-end tests                                                                                         |
| `pnpm db:generate`                                   | Generate a migration from schema changes in `src/db/schema`                                                         |
| `pnpm db:migrate` / `pnpm db:seed`                   | Apply migrations / upsert reference data                                                                            |
| `pnpm db:studio`                                     | Drizzle Studio                                                                                                      |
| `pnpm admin:promote <email-or-username>`             | Grant the admin role to an existing account                                                                         |
| `pnpm db:up` / `pnpm db:down`                        | Start / stop local Postgres. Data is kept in the `pgdata` volume.                                                   |
| `pnpm db:reset`                                      | **Deletes all local dev and test data** (removes the `pgdata` volume) and starts a fresh database                   |

The integration and e2e setups drop and recreate the schema of the `_test` and
`_e2e` databases on every run; they never touch the dev database. `pnpm e2e`
starts its own `next dev` on port 3100 with emails written to `.tmp/e2e-mail`,
so stop any running `pnpm dev` first (Next allows one dev server per project).

## Auth and the first admin

- Sign-in: Google (when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set) or
  username/email + password. New accounts are signed in right away; confirming
  the email is required later for commenting.
- Google OAuth client: add `<BETTER_AUTH_URL>/api/auth/callback/google` as an
  authorized redirect URI (e.g. `http://localhost:3000/api/auth/callback/google`).
- Create the first admin by registering normally, then running
  `pnpm admin:promote <email-or-username>` against that environment's database.
- `/admin` is open to `admin` and `moderator` roles. Every admin page and server
  action must call `requireRole()` from `src/lib/session.ts`; `src/proxy.ts`
  only redirects visitors with no session cookie.

## Research pipeline

Profiles are researched with Claude Code and published only after admin review
(PLAN §6). The protocol lives in `.claude/skills/research-politician/SKILL.md`.

1. An admin queues jobs in `/admin/investigacion` and creates a research token
   in `/admin/investigacion/tokens` (or `pnpm research:token <name>` locally).
2. Put the token in `.env.local` as `RESEARCH_TOKEN` (and `RESEARCH_API_URL` if
   the app isn't on `http://localhost:3000`), then in Claude Code ask it to
   research the next profile. It runs `pnpm research:claim`, writes
   `research/out/<jobId>.json`, checks it with `pnpm research:validate` and
   sends it with `pnpm research:submit <jobId> <file>`.
3. The admin reviews the diff, validation report and preview, then approves
   selected sections, requests changes (the note goes back with the next claim),
   rejects, or edits the JSON (saved as a new submission version).

Publishing runs in one transaction, writes a profile revision and refuses any
profile that would have a claim without a source.
