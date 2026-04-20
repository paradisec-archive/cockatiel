# Cockatiel — project conventions

## Scripts

Prefer the project's `pnpm` scripts over raw tool invocations:

- `pnpm lint:types` — TypeScript type-check (`tsc --noEmit`)
- `pnpm lint:biome` — Biome lint/format check
- `pnpm lint:knip` — unused exports / dependencies
- `pnpm test` — Vitest (one-shot)
- `pnpm test:watch` — Vitest (watch)
- `pnpm dev` — Vite dev server (NEVER offer to run this — the dev server is always already running)
- `pnpm build` — production build

## Imports

- `lucide-react` icons: always use the `Icon`-suffixed alias (e.g. `PlayIcon`, `Loader2Icon`), never the bare name.
