@AGENTS.md

# DR Politicians

Source-backed profiles of all living current and former Dominican Republic politicians.
Public site (Spanish only) + admin backoffice. The plan and decisions live in
[docs/PLAN.md](docs/PLAN.md); it is the authority for scope and architecture.

## Commands

- `pnpm dev` — dev server
- `pnpm lint` — ESLint
- `pnpm build` — production build

## Boundaries

- UI copy and profile content are in Spanish; code identifiers and docs in English.
- Never publish profile data without admin review; research output is a draft.
- Every profile claim must link to at least one source (see PLAN §6.3).
- Secrets go in `.env.local` / Vercel env, never in the repo.
