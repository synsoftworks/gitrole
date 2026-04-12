# Contributing

## Before You Start

- Open an issue for bugs, significant behavior changes, or new feature proposals before large implementation work.
- Keep pull requests focused. Small, reviewable changes move faster than broad refactors.
- Preserve the existing Clean Architecture split. Do not collapse shell logic into CLI wiring or application use cases.

## Development Setup

```bash
npm install
npm run build
npm test
```

For local CLI testing:

```bash
npm link
gitrole --help
```

## Project Structure

- `src/cli`: Commander wiring and process behavior
- `src/application`: use cases and application contracts
- `src/domain`: domain models and parsing rules
- `src/adapters`: filesystem, git, SSH, and repository integrations
- `src/interface`: plain-text rendering
- `test`: Node test coverage across adapters, use cases, and CLI routing

## Contribution Guidelines

- Keep changes scoped to the problem being solved.
- Prefer explicit interfaces and small adapters over implicit shell behavior.
- Preserve backwards compatibility for existing commands unless a breaking change is intentional and documented.
- Add or update tests for behavior changes.
- Add a short top-of-file summary comment to each new TypeScript file.
- Add TSDoc comments to new exported APIs that are part of the public or broadly reused surface.
- For tests, keep the file summary and add comments only where setup or fixtures are non-obvious.
- For internal modules, prefer lightweight intent comments over full API docs unless the module is reused heavily.
- Comments should explain intent and behavior, not restate the syntax that readers can already see.
- When using TSDoc, avoid JSDoc-only patterns such as `@throws {Type}`.
- Keep CLI output concise and script-friendly: success to stdout, warnings/errors to stderr.
- Use plain text output only. Do not introduce interactive prompts or TUIs.

## Branch Hygiene

- Use PRs to merge into `main`; avoid direct pushes to the long-lived branch.
- Delete merged topic branches when the work is complete.
- Keep branch names short, readable, and scoped to the work being done.
- Follow [RELEASING.md](./RELEASING.md) for release tags, GitHub Releases, and release validation.

## Pull Request Checklist

- The change is documented when user-facing behavior changes.
- `npm run build` passes.
- `npm test` passes.
- New behavior includes targeted test coverage.
- Error handling and exit codes remain clear and intentional.

## Release Notes

If your change affects users directly, include a short summary that explains:

- what changed
- why it changed
- any compatibility or workflow implications
