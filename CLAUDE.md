@AGENTS.md

# DR Politicians

Source-backed profiles of all living current and former Dominican Republic politicians.
Public site (Spanish only) + admin backoffice. The plan and decisions live in
[docs/PLAN.md](docs/PLAN.md); it is the authority for scope and architecture.

## Commands

- `pnpm db:up && pnpm db:migrate && pnpm db:seed` — local Postgres (Docker, port 54329)
- `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build` — what CI runs
- `pnpm e2e` — Playwright
- `pnpm db:generate` after editing `src/db/schema/*`; hand-written SQL goes in a
  `drizzle-kit generate --custom` migration

Full command list: README.md.

## Boundaries

- UI copy and profile content are in Spanish; code identifiers and docs in English.
- Never publish profile data without admin review; research output is a draft.
- Every profile claim must link to at least one source (see PLAN §6.3).
- Secrets go in `.env.local` / Vercel env, never in the repo.
- Every admin page and server action calls `requireRole()` (`src/lib/session.ts`);
  `src/proxy.ts` is only an optimistic redirect.
- Cache Components is on: request-time reads (session, `searchParams`) go inside
  `<Suspense>`, or the segment sets `export const instant = false` (admin only).
