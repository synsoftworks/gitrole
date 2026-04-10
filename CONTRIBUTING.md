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
- Keep CLI output concise and script-friendly: success to stdout, warnings/errors to stderr.
- Use plain text output only. Do not introduce interactive prompts or TUIs.

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
