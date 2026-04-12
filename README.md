<h1 align="center">gitrole</h1>

<p align="center">
  Switch your git identity in one command.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/gitrole"><img alt="npm version" src="https://img.shields.io/npm/v/gitrole?style=flat-square"></a>
  <a href="https://www.npmjs.com/package/gitrole"><img alt="npm downloads" src="https://img.shields.io/npm/dm/gitrole?style=flat-square"></a>
  <a href="https://nodejs.org/"><img alt="node version" src="https://img.shields.io/node/v/gitrole?style=flat-square"></a>
  <a href="https://github.com/synsoftworks/gitrole/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/synsoftworks/gitrole?style=flat-square"></a>
</p>

`gitrole` is a focused CLI for developers who move between multiple Git identities — work, personal, client, open source. It stores named roles, switches your Git config in one command at global or repository-local scope, and diagnoses whether your repo and SSH auth path are actually aligned before you push.

## Install

```bash
npm install -g gitrole
```

## Quickstart

```bash
gitrole add work \
  --name "Alex Developer" \
  --email "alex@work.example" \
  --ssh ~/.ssh/id_work \
  --github-user acme-dev \
  --github-host github.com-acme-dev

gitrole use work
gitrole use work --local
gitrole status
gitrole doctor
```

## Commands

| Command                                                                                             | Purpose                                                        |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `gitrole add <name> --name "..." --email "..." [--ssh ...] [--github-user ...] [--github-host ...]` | Create or update a saved role profile                          |
| `gitrole use <name> [--global \| --local]`                                                          | Switch git identity at global or repository-local scope and optionally load SSH key |
| `gitrole resolve`                                                                                   | Print the repo-local default role from `.gitrole`               |
| `gitrole current`                                                                                   | Show which saved role matches the active commit identity       |
| `gitrole list`                                                                                      | List all saved roles and mark the active one                   |
| `gitrole status`                                                                                    | Quick human-readable repo and alignment check                  |
| `gitrole status --short`                                                                            | Machine-friendly alignment fields for scripts and prompts      |
| `gitrole doctor`                                                                                    | Diagnose commit identity, remote config, and SSH push identity |
| `gitrole doctor --json`                                                                             | Emit the full diagnosis as structured JSON                     |
| `gitrole remote set <name>`                                                                         | Rewrite origin to the role's GitHub SSH host alias             |
| `gitrole remove <name>`                                                                             | Remove a saved role profile                                    |

## SSH Host Aliases

For deterministic GitHub SSH identity per role, add host aliases to `~/.ssh/config`:

```sshconfig
Host github.com-acme-dev
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_work
  IdentitiesOnly yes
```

Then `gitrole remote set work` rewrites `origin` to use that alias, ensuring pushes authenticate as the right GitHub account.

## SSH Config vs gitrole Roles

These are related, but they are not the same thing:

- `~/.ssh/config` defines how SSH connects to a host alias
- `gitrole` defines a named git identity role

Use both together:

1. Create an SSH host alias in `~/.ssh/config`

```sshconfig
Host github.com-personal
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_personal
  IdentitiesOnly yes
```

2. Create a matching `gitrole` role

```bash
gitrole add personal \
  --name "Alex Developer" \
  --email "alex@personal.example" \
  --ssh ~/.ssh/id_ed25519_personal \
  --github-user alex-dev \
  --github-host github.com-personal
```

What each flag means:

- `--ssh` tells `gitrole` which key to load with `ssh-add`
- `--github-host` tells `gitrole` which SSH host alias the role expects

`gitrole` does not replace `~/.ssh/config`, and you do not copy SSH config blocks into `gitrole`. The usual setup is:

1. define a host alias in `~/.ssh/config`
2. create a matching `gitrole` role that points at that key and alias

## Scoped Use

`gitrole use <role>` keeps the original global behavior.

Use `--local` when you want the selected identity applied only to the current repository:

```bash
gitrole use work --local
```

That updates:

- `git config --local user.name`
- `git config --local user.email`

Example output:

```text
switched to work
  scope local
  name  Alex Developer
  email alex@work.example
```

If repo alignment issues are detected after a successful switch, `gitrole use` prints a short repo note and points you to `gitrole status`.

`gitrole status` reflects the effective scope in its plain-text output:

```text
work  Alex Developer <alex@work.example>  local override  aligned
```

`gitrole status --short` exposes scope and override state for scripts:

```text
role=work scope=local override=true commit=ok remote=ok auth=ok overall=aligned
```

## Repo-Local Policy

If a repository has a root-level `.gitrole` file, `gitrole` can also describe
which roles belong there.

Example:

```json
{
  "version": 1,
  "defaultRole": "company-main",
  "allowedRoles": ["company-main", "maintainer-personal"]
}
```

What each field means:

- `defaultRole` is the preferred saved role for that repository
- `allowedRoles` is the set of saved roles that are still valid there

Use `gitrole resolve` when you want the repo's preferred role:

```bash
gitrole resolve
```

`gitrole status` and `gitrole doctor` also become policy-aware when `.gitrole`
is present:

- default role matched: `ok`
- allowed but not default: `info`
- not allowed: `warn`

This is repo-local identity policy only. It does not auto-switch roles, install
hooks, or enforce commits.

## Automation and Agents

`gitrole` is also useful in automation. Use `gitrole status --short` for a quick
machine-friendly preflight check, and use `gitrole doctor --json` when an agent
needs structured detail about repo, remote, and SSH identity state before
committing or pushing.

## Diagnosis Policy

`gitrole` warns on violated expectations, not assumptions.

- `githubUser` checks the resolved SSH auth user
- `githubHost` checks the remote host alias
- remote owner and repository are context by default
- `overall=warning` only happens when at least one actionable check is `warn`

`gitrole doctor` also shows:

- the effective scope: `global`, `local`, `mixed`, or `unset`
- whether repo-local overrides are active
- whether the matched role is applied through the current scope
- the hidden global identity when a local override is masking different global values

## What It Does Not Do

- No GitHub browser or session switching
- No `gh auth`, HTTPS credentials, or token management
- No interactive prompts

## License

MIT
