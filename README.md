# gitrole

`gitrole` is a focused CLI for developers who switch between multiple Git identities.

It stores named roles such as `work`, `personal`, or `client-acme`, then applies the selected identity to your global Git config in one command.

In v0.2.0 it also adds a repo-aware `doctor` command so you can inspect the gap between:

- the saved role you expect
- the Git identity your commits will use
- the repo remote you are about to push to
- the SSH auth identity GitHub will likely see for SSH pushes

## Why

If you regularly move between:

- work repositories
- personal projects
- client codebases
- side projects
- open source contributions

you eventually end up repeating the same Git setup work:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
ssh-add ~/.ssh/id_whatever
```

`gitrole` turns that into:

```bash
gitrole use work
```

## What It Does

- Stores named Git identity profiles
- Switches global `user.name`
- Switches global `user.email`
- Optionally loads an SSH key with `ssh-add`
- Shows the currently active role when it exactly matches a saved profile
- Diagnoses the current repository, `origin`, and SSH push identity with `gitrole doctor`

## What It Does Not Do

- It does not switch GitHub sessions or browser logins
- It does not manage HTTPS credentials or access tokens
- It does not manage `gh auth`, browser sessions, or GitHub account sessions for you
- It does not auto-detect SSH keys
- It does not prompt interactively
- It does not apply repo-local config yet

This is intentionally a small tool with a stable boundary.

## Requirements

- Node.js 20+
- npm
- Git available on `PATH`
- `ssh-add` available on `PATH` if you want SSH key loading

## Install

### Local Development

```bash
npm install
npm run build
```

### Run Without Installing Globally

```bash
node dist/cli/index.js --help
```

### Optional Local Link

If you want to invoke it as `gitrole` during development:

```bash
npm link
gitrole --help
```

## Configuration

Roles are stored as JSON using the XDG config convention:

- `$XDG_CONFIG_HOME/gitrole/roles.json`
- or `~/.config/gitrole/roles.json` when `XDG_CONFIG_HOME` is not set

The file is created automatically on first use.

Example:

```json
{
  "roles": [
    {
      "name": "work",
      "fullName": "Alex Developer",
      "email": "alex@work.example",
      "sshKeyPath": "~/.ssh/id_work",
      "githubUser": "acme-dev",
      "githubHost": "github.com-acme-dev"
    },
    {
      "name": "personal",
      "fullName": "Alex Developer",
      "email": "alex@personal.example"
    }
  ]
}
```

## Usage

| Command | Purpose |
| --- | --- |
| `gitrole add <name> --name "..." --email "..." [--ssh ...] [--github-user ...] [--github-host ...]` | Create or update a saved role profile. |
| `gitrole use <name>` | Switch global Git identity to the selected role and optionally load its SSH key. |
| `gitrole current` | Show which saved role matches the active Git commit identity. |
| `gitrole current --verbose` | Show the current role plus repository and auth diagnostics. |
| `gitrole list` | List all saved roles and mark the active one. |
| `gitrole doctor` | Diagnose commit identity, remote configuration, and SSH push identity. |
| `gitrole remote use <name>` | Rewrite `origin` to the selected role's GitHub host alias. |
| `gitrole remove <name>` | Remove a saved role profile. |

### Add a Role

```bash
gitrole add work \
  --name "Alex Developer" \
  --email "alex@work.example" \
  --ssh ~/.ssh/id_work \
  --github-user acme-dev \
  --github-host github.com-acme-dev
```

Without an SSH key:

```bash
gitrole add personal \
  --name "Alex Developer" \
  --email "alex@personal.example"
```

If a role with the same name already exists, it is updated in place.

`--github-user` and `--github-host` are optional. They are used by `gitrole doctor` to compare the active repository and SSH auth path against the role you intended to use.

### Switch to a Role

```bash
gitrole use work
```

This updates:

- `git config --global user.name`
- `git config --global user.email`

If the role has an SSH key, `gitrole` also runs:

```bash
ssh-add ~/.ssh/id_work
```

Example output:

```text
switched to work
  name  Alex Developer
  email alex@work.example
  ssh   ~/.ssh/id_work (loaded)
```

If `ssh-add` fails, the Git identity still changes and the warning is sent to stderr.

### Show the Current Role

```bash
gitrole current
```

`current` reads the active global Git identity and compares it to saved roles.

A role is considered active only when both of these match exactly:

- `user.name`
- `user.email`

If no saved role matches, `gitrole` prints `no matching role`.

For repo-aware diagnostics from the current command surface:

```bash
gitrole current --verbose
```

This runs the same repository and auth checks as `gitrole doctor`.

### List Saved Roles

```bash
gitrole list
```

The active role is marked with `*`.

Example:

```text
* work Alex Developer <alex@work.example> ~/.ssh/id_work
  personal Alex Developer <alex@personal.example>
```

### Remove a Role

```bash
gitrole remove personal
```

This removes the saved profile from `roles.json`. It does not change your current global Git config.

### Diagnose the Current Repository

```bash
gitrole doctor
```

`doctor` is repo-aware enough to answer:

1. Who will this commit say it is from?
2. Who will GitHub think I am when I push?

It inspects:

- local-vs-global Git commit identity
- whether you are in a Git repository
- the current branch and upstream
- the `origin` remote URL
- the parsed remote host and owner
- the SSH identity returned by probing the remote host for SSH remotes

Typical output looks like:

```text
doctor
  role   work
  name   Alex Developer (global)
  email  alex@work.example (global)
  gh     acme-dev
  host   github.com-acme-dev
  repo   /path/to/repo
  branch main
  remote git@github.com-acme-dev:acme-dev/gitrole.git
  auth   acme-dev via github.com-acme-dev

checks
  ok   role   commit identity matches saved role work
  ok   host   remote host matches role githubHost github.com-acme-dev
  ok   auth   SSH auth matches role githubUser acme-dev
```

For HTTPS remotes, `doctor` will tell you that SSH auth cannot be verified.

Exit behavior:

- `0` when diagnostics are aligned
- `2` when mismatches or warning states are found
- `1` for operational failures such as missing dependencies

### Rewrite `origin` for a Role

```bash
gitrole remote use work
```

This rewrites the `origin` remote to the selected role's `githubHost` while preserving the observed repository owner and name.

Example:

```text
updated remote origin for work
  from git@github.com:acme-dev/gitrole.git
  to   git@github.com-acme-dev:acme-dev/gitrole.git
```

This is the correction step for the common failure mode where:

- commit identity looks correct
- the repo remote still points at the wrong SSH host
- pushes authenticate as the wrong GitHub account

### Repo-Aware Warnings During `use`

```bash
gitrole use work
```

After switching global Git identity, `gitrole` now performs a best-effort repo alignment check when you are inside a Git repository. It warns to stderr when it detects issues such as:

- repo-local Git config overriding the selected role
- `origin` using the wrong SSH host alias
- remote owner mismatch against the selected role
- SSH auth resolving to a different GitHub user
- HTTPS remotes that prevent SSH auth verification
- repositories with no commits yet

## Examples

### Work and Personal

```bash
gitrole add work --name "Alex Developer" --email "alex@work.example" --ssh ~/.ssh/id_work --github-user acme-dev --github-host github.com-acme-dev
gitrole add personal --name "Alex Developer" --email "alex@personal.example" --ssh ~/.ssh/id_personal

gitrole use work
gitrole doctor
gitrole use personal
```

### Client Projects

```bash
gitrole add acme --name "Alex Developer" --email "alex@client.example" --ssh ~/.ssh/id_acme
gitrole use acme
```

## Testing

Run the automated checks:

```bash
npm test
npm run build
```

## Safe Manual Smoke Test

If you want to test without touching your real global Git identity, use a temporary `HOME`:

```bash
TMP_HOME="$(mktemp -d)"

HOME="$TMP_HOME" XDG_CONFIG_HOME="$TMP_HOME/config" node dist/cli/index.js add demo --name "Alex Developer" --email "alex@work.example"
HOME="$TMP_HOME" XDG_CONFIG_HOME="$TMP_HOME/config" node dist/cli/index.js use demo
HOME="$TMP_HOME" XDG_CONFIG_HOME="$TMP_HOME/config" node dist/cli/index.js current
HOME="$TMP_HOME" XDG_CONFIG_HOME="$TMP_HOME/config" node dist/cli/index.js list
```

## Error Behavior

- Unknown role: exits with code `1`
- Missing `git`: exits with code `1`
- `ssh-add` failure: prints a warning to stderr but still succeeds
- Config file missing: created automatically
- `doctor`: exits with `2` when warnings or mismatches are found

## Architecture

The codebase is intentionally split into small layers:

- [src/cli/index.ts](/Users/slodev/Work/gitrole/src/cli/index.ts): Commander wiring and process exit behavior
- [src/application/use-cases.ts](/Users/slodev/Work/gitrole/src/application/use-cases.ts): core application behavior
- [src/domain/role.ts](/Users/slodev/Work/gitrole/src/domain/role.ts): role model and identity matching rules
- [src/adapters/role-store.ts](/Users/slodev/Work/gitrole/src/adapters/role-store.ts): JSON config persistence
- [src/adapters/git-config.ts](/Users/slodev/Work/gitrole/src/adapters/git-config.ts): Git integration
- [src/adapters/git-repository.ts](/Users/slodev/Work/gitrole/src/adapters/git-repository.ts): repository and remote inspection
- [src/adapters/ssh-agent.ts](/Users/slodev/Work/gitrole/src/adapters/ssh-agent.ts): SSH key loading
- [src/adapters/ssh-auth.ts](/Users/slodev/Work/gitrole/src/adapters/ssh-auth.ts): SSH auth probing for GitHub
- [src/interface/renderer.ts](/Users/slodev/Work/gitrole/src/interface/renderer.ts): plain-text output rendering

## Notes

- `gitrole` changes global Git config, not per-repository config
- SSH key loading is most useful when your remotes use SSH
- `gitrole doctor` can only verify push auth for SSH remotes, not HTTPS remotes
- `gitrole remote use <role>` rewrites only the SSH host alias; it intentionally preserves the observed remote owner and repository name
- If you work across identities simultaneously, repo-local switching may be a better future enhancement than more global state
