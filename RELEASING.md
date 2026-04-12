# Releasing

`gitrole` is shipped primarily through npm. This document keeps the release path short, repeatable, and easy to verify.

## Release Policy

- Release tags use `vX.Y.Z`.
- `package.json` stays semver-aligned with the release tag. Example: tag `v0.4.1` matches package version `0.4.1`.
- Every release tag should have a corresponding GitHub Release.
- npm is the canonical shipped artifact. GitHub Releases document the version; npm is the package users install.
- Existing legacy tags may use older naming. New releases should use the `vX.Y.Z` format only.

## Release Checklist

1. Merge conventional-commit changes to `main`.
2. Let Release Please open or update the release PR.
3. Review the release PR contents:
   - `package.json` and `package-lock.json` version bump
   - generated changelog/release notes
   - green CI
4. Merge the release PR to `main`.
5. Let Release Please create the `vX.Y.Z` tag and corresponding GitHub Release from that merged `main` commit.
6. Let `.github/workflows/publish.yml` publish the package to npm from the published GitHub Release.
7. Verify the release externally:
   - `npm view gitrole version`
   - confirm the GitHub Release exists for `vX.Y.Z`
   - confirm the docs site is live at `https://docs.gitrole.dev`

Manual version bumps and hand-cut release tags should no longer be the default path. If Release Please is unavailable, follow the same invariants manually: cut the version on `main`, tag the merged `main` commit with `vX.Y.Z`, and publish only after the GitHub Release is created.

## GitHub Release Notes Template

Use this as the starting point for each GitHub Release:

```md
## Summary

- Short description of the release.

## Notable Changes

- Change 1
- Change 2

## Breaking Changes

- None

## Docs

- Docs site: https://docs.gitrole.dev

## Package

- npm: https://www.npmjs.com/package/gitrole
```

Keep the notes focused on externally meaningful changes. Pull request bodies are good input, but they are not the release note by themselves.

## Branch Hygiene

- Use pull requests to merge into `main`.
- Keep `main` as the protected long-lived branch.
- Delete merged topic branches once they are no longer needed.
- Keep branch names short, readable, and scoped, for example `feat/...`, `fix/...`, `docs/...`, `test/...`, or `ci/...`.
- Reserve release tags for shipped versions only. Do not use ad hoc tags for temporary checkpoints.

## Governance Expectations

- Branch protection or rulesets should prevent direct pushes to `main`.
- Required CI should stay green before merging.
- Tag protections, when configured, should reserve `v*.*.*` tags for intentional releases.

## Safe Automation

- The repository includes `.github/workflows/release-please.yml` to manage the release PR, release tag, and GitHub Release for the root npm package. It should use a GitHub App token generated from `RELEASE_PLEASE_APP_ID` and `RELEASE_PLEASE_APP_PRIVATE_KEY`; the default `GITHUB_TOKEN` is not sufficient because tags and releases created with it will not trigger `.github/workflows/publish.yml`.
- The repository includes a tag-validation workflow for release tags. It validates version alignment and runs the release-confidence checks, but it does not publish to npm or create a GitHub Release automatically.
- The repository also includes `.github/workflows/publish.yml` for npm Trusted Publishing. When npm Trusted Publishing is configured for this repository and workflow filename, a published GitHub Release can publish the tagged version to npm without an npm token.
