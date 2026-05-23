# Obsidian community plugin

## Project overview
- Target: Obsidian Community Plugin (TypeScript → bundled JavaScript).
- Entry point: `src/main.ts` compiled to `main.js`.
- Package manager: `pnpm`. Bundler: `esbuild`.

## Agent Guidelines
**Do**
- Organize code logically across multiple files in `src/`.
- Keep `main.ts` focused on plugin lifecycle and delegating feature logic.
- Add commands with stable IDs.
- Provide defaults and validation in settings.
- Write idempotent code paths so reload/unload doesn't leak listeners.
- Use `this.register*` helpers for DOM, events, and intervals.

**Don't**
- Introduce network calls or cloud dependencies without explicit user permission.
- Avoid large dependencies. Bundle everything into `main.js`.

## Custom Rules
- After every code modification, automatically run `pnpm run build` to compile the changes.
