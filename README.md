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
| `gitrole current`                                                                                   | Show which saved role matches the active commit identity       |
| `gitrole current --verbose`                                                                         | Show current role plus repo and auth diagnostics               |
| `gitrole list`                                                                                      | List all saved roles and mark the active one                   |
| `gitrole status`                                                                                    | Compact one-line alignment summary                             |
| `gitrole status --short`                                                                            | Machine-friendly alignment fields for scripts and prompts      |
| `gitrole doctor`                                                                                    | Diagnose commit identity, remote config, and SSH push identity |
| `gitrole remote use <name>`                                                                         | Rewrite origin to the role's GitHub SSH host alias             |
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

Then `gitrole remote use work` rewrites `origin` to use that alias, ensuring pushes authenticate as the right GitHub account.

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

`gitrole status` reflects the effective scope in its plain-text output:

```text
work  Alex Developer <alex@work.example>  local override  aligned
```

`gitrole status --short` exposes scope and override state for scripts:

```text
role=work scope=local override=true commit=ok remote=ok auth=ok overall=aligned
```

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
