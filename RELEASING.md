# Releasing

`gitrole` is shipped primarily through npm. This document keeps the release path short, repeatable, and easy to verify.

## Release Policy

- Release tags use `vX.Y.Z`.
- `package.json` stays semver-aligned with the release tag. Example: tag `v0.4.1` matches package version `0.4.1`.
- Every release tag should have a corresponding GitHub Release.
- npm is the canonical shipped artifact. GitHub Releases document the version; npm is the package users install.
- Existing legacy tags may use older naming. New releases should use the `vX.Y.Z` format only.

## Release Checklist

1. Update `package.json` to the intended version.
2. Run `npm run test:release`.
3. Run `npm pack --dry-run`.
4. Run `npm run docs:build`.
5. Merge the release-ready change to `main`.
6. Wait for CI on the current `main` tip to finish green, then create the release tag from that exact commit:

   ```bash
   git checkout main
   git pull --ff-only
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```

7. Publish the package to npm using the existing publishing flow.
8. Create the GitHub Release for `vX.Y.Z`.
9. Verify the release externally:
   - `npm view gitrole version`
   - confirm the GitHub Release exists for `vX.Y.Z`
   - confirm the docs site is live at `https://docs.gitrole.dev`

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

- The repository includes a tag-validation workflow for release tags. It validates version alignment and runs the release-confidence checks, but it does not publish to npm or create a GitHub Release automatically.
- The repository also includes `.github/workflows/publish.yml` for npm Trusted Publishing. When npm Trusted Publishing is configured for this repository and workflow filename, a published GitHub Release can publish the tagged version to npm without an npm token.
