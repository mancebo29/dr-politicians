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

The integration test setup drops and recreates the schema of the `_test`
database on every run; it never touches the dev database.
