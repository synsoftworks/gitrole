<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/gitrole-white.png">
    <img src="docs/assets/gitrole-black.png" alt="gitrole" width="100">
  </picture>
</p>

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

`gitrole` is a focused CLI for developers who move between multiple Git identities on one machine. Save named roles like `work`, `personal`, or `client-acme`, switch to the right one, and check the repo before you commit or push.

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

gitrole use work --local
gitrole status
```

That is the basic workflow:

1. save a role
2. switch this repo to it
3. check the repo before you commit or push

Run `gitrole doctor` when something looks wrong.

## Learn more

Start with the docs if you want the full workflow, setup guides, and use cases:

- [Docs homepage](https://docs.gitrole.dev)
- [Guide: Use the right Git identity for this repo](https://docs.gitrole.dev/guides/use-the-right-git-identity-for-this-repo/)
- [Guide: Use repo-local identity policy with .gitrole](https://docs.gitrole.dev/guides/use-repo-local-identity-policy-with-gitrole/)
- [Use case: Fix pushes using the wrong GitHub account](https://docs.gitrole.dev/use-cases/fix-pushes-using-the-wrong-github-account/)

## Commands

| Command                                                                                             | Purpose                                                                             |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `gitrole add <name> --name "..." --email "..." [--ssh ...] [--github-user ...] [--github-host ...]` | Create or update a saved role profile                                               |
| `gitrole use <name> [--global \| --local]`                                                          | Switch git identity at global or repository-local scope and optionally load SSH key |
| `gitrole resolve`                                                                                   | Print the repo-local default role from `.gitrole`                                   |
| `gitrole current`                                                                                   | Show which saved role matches the active commit identity                            |
| `gitrole list`                                                                                      | List all saved roles and mark the active one                                        |
| `gitrole status`                                                                                    | Quick human-readable repo and alignment check                                       |
| `gitrole status --short`                                                                            | Machine-friendly alignment fields for scripts and prompts                           |
| `gitrole doctor`                                                                                    | Diagnose commit identity, remote config, and SSH push identity                      |
| `gitrole doctor --json`                                                                             | Emit the full diagnosis as structured JSON                                          |
| `gitrole remote set <name>`                                                                         | Rewrite origin to the role's GitHub SSH host alias                                  |
| `gitrole remove <name>`                                                                             | Remove a saved role profile                                                         |

## Diagnosis policy

`gitrole` warns on violated expectations, not assumptions.

- `githubUser` checks the resolved SSH auth user
- `githubHost` checks the remote host alias
- remote owner and repository are context by default
- `overall=warning` only happens when at least one actionable check is `warn`

## What it does not do

- No GitHub browser or session switching
- No `gh auth`, HTTPS credentials, or token management
- No hooks, auto-switching, or workflow enforcement
- No interactive prompts

## License

MIT
