<h1 align="center">gitrole</h1>

<p align="center">
  Switch your git identity in one command.
</p>

`gitrole` is a focused CLI for developers who move between multiple Git identities such as work, personal, client, and open source roles. It stores named roles, applies the selected Git identity to your global config, and helps diagnose whether your current repo and SSH auth path are aligned before you push.

<p align="center">
  <a href="https://www.npmjs.com/package/gitrole"><img alt="npm version" src="https://img.shields.io/npm/v/gitrole?style=flat-square"></a>
  <a href="https://www.npmjs.com/package/gitrole"><img alt="npm downloads" src="https://img.shields.io/npm/dm/gitrole?style=flat-square"></a>
  <a href="https://nodejs.org/"><img alt="node version" src="https://img.shields.io/node/v/gitrole?style=flat-square"></a>
  <a href="https://github.com/synsoftworks/gitrole/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/synsoftworks/gitrole?style=flat-square"></a>
</p>

## Quickstart

```bash
npm install -g gitrole

gitrole add work \
  --name "Alex Developer" \
  --email "alex@work.example" \
  --ssh ~/.ssh/id_work \
  --github-user acme-dev \
  --github-host github.com-acme-dev

gitrole use work
gitrole status
gitrole doctor
```

## What It Does

- Stores named Git identity profiles
- Switches global `user.name`
- Switches global `user.email`
- Optionally loads an SSH key with `ssh-add`
- Shows which saved role matches the active commit identity
- Shows a one-line repo and auth alignment summary with `gitrole status`
- Diagnoses repo, remote, and SSH push alignment with `gitrole doctor`
- Can rewrite `origin` to a role-specific GitHub SSH host alias

## What It Does Not Do

- It does not switch GitHub browser sessions
- It does not manage `gh auth`, HTTPS credentials, or tokens
- It does not auto-detect SSH keys
- It does not prompt interactively
- It does not apply repo-local config yet

This is intentionally a small tool with a stable boundary.

## Install

### Global Install

```bash
npm install -g gitrole
```

### One-Off Run

```bash
npx gitrole --help
```

## Commands

| Command                                                                                             | Purpose                                                                          |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `gitrole add <name> --name "..." --email "..." [--ssh ...] [--github-user ...] [--github-host ...]` | Create or update a saved role profile.                                           |
| `gitrole use <name>`                                                                                | Switch global Git identity to the selected role and optionally load its SSH key. |
| `gitrole current`                                                                                   | Show which saved role matches the active Git commit identity.                    |
| `gitrole current --verbose`                                                                         | Show the current role plus repository and auth diagnostics.                      |
| `gitrole list`                                                                                      | List all saved roles and mark the active one.                                    |
| `gitrole status`                                                                                    | Show a compact one-line alignment summary for the current repo and identity.     |
| `gitrole status --short`                                                                            | Show machine-friendly alignment fields for scripts and shell integrations.       |
| `gitrole doctor`                                                                                    | Diagnose commit identity, remote configuration, and SSH push identity.           |
| `gitrole remote use <name>`                                                                         | Rewrite `origin` to the selected role's GitHub host alias.                       |
| `gitrole remove <name>`                                                                             | Remove a saved role profile.                                                     |

## SSH Host Aliases

For deterministic GitHub SSH identity, define host aliases in `~/.ssh/config`:

```sshconfig
Host github.com-acme-dev
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_work
  IdentitiesOnly yes
```

Then `gitrole remote use work` can rewrite `origin` to use that alias.

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

In v0.2.0, `gitrole doctor` helps detect when your commit identity, repo remote, and SSH push identity are out of alignment.

## Configuration

Roles are stored as JSON using the XDG config convention:

- `$XDG_CONFIG_HOME/gitrole/roles.json`
- `~/.config/gitrole/roles.json` when `XDG_CONFIG_HOME` is not set

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

`--github-user` and `--github-host` are optional. They are used by `gitrole doctor` and `gitrole remote use` to compare and align the active repository against the role you intended to use.

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

When you run `gitrole use <role>` inside a Git repository, `gitrole` also performs a best-effort repo alignment check and warns when:

- repo-local Git config overrides the selected role
- `origin` uses the wrong SSH host alias
- the remote owner does not match the role
- SSH auth resolves to a different GitHub user
- the repo uses HTTPS, so SSH auth cannot be verified
- the repository has no commits yet

### Show the Current Role

```bash
gitrole current
```

`current` is role-focused. It tells you whether the effective Git commit identity matches one of your saved profiles.

A role is considered active only when both of these match exactly:

- `user.name`
- `user.email`

If no saved role matches, `gitrole` prints `no matching role`.

For repo-aware diagnostics:

```bash
gitrole current --verbose
```

`current --verbose` is diagnostic. It includes the same repository and auth checks as `gitrole doctor`.

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

### Show a Compact Status

```bash
gitrole status
```

`status` is the shortest repo-aware view. It is designed for quick checks in a terminal, alias, or prompt.

The plain-text form is intentionally compact and uses a small final state vocabulary:

- `aligned`
- `warning`

Example:

```text
work  Alex Developer <alex@work.example>  aligned
```

For machine-friendly output:

```bash
gitrole status --short
```

Example:

```text
role=work commit=ok remote=ok auth=ok overall=aligned
```

`status --short` is intended to be stable for shell scripts, prompts, and automation. Treat its keys and values as the supported machine-readable interface for the compact status command.

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

For HTTPS remotes, `doctor` reports that SSH auth cannot be verified.

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

### Remove a Role

```bash
gitrole remove personal
```

This removes the saved profile from `roles.json`. It does not change your current global Git config.

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

## Community

- [Contributing](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [License](./LICENSE)
