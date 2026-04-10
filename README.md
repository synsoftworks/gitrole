# gitrole

`gitrole` is a focused CLI for developers who switch between multiple Git identities.

It stores named roles such as `work`, `personal`, or `client-acme`, then applies the selected identity to your global Git config in one command.

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

## What It Does Not Do

- It does not switch GitHub sessions or browser logins
- It does not manage HTTPS credentials or access tokens
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
      "fullName": "Sara Loera",
      "email": "sara@synthesissoftworks.com",
      "sshKeyPath": "~/.ssh/id_work"
    },
    {
      "name": "personal",
      "fullName": "Sara Loera",
      "email": "sara@example.com"
    }
  ]
}
```

## Usage

### Add a Role

```bash
gitrole add work \
  --name "Sara Loera" \
  --email "sara@synthesissoftworks.com" \
  --ssh ~/.ssh/id_work
```

Without an SSH key:

```bash
gitrole add personal \
  --name "Sara Loera" \
  --email "sara@example.com"
```

If a role with the same name already exists, it is updated in place.

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
  name  Sara Loera
  email sara@synthesissoftworks.com
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

### List Saved Roles

```bash
gitrole list
```

The active role is marked with `*`.

Example:

```text
* work Sara Loera <sara@synthesissoftworks.com> ~/.ssh/id_work
  personal Sara Loera <sara@example.com>
```

### Remove a Role

```bash
gitrole remove personal
```

This removes the saved profile from `roles.json`. It does not change your current global Git config.

## Examples

### Work and Personal

```bash
gitrole add work --name "Sara Loera" --email "sara@synthesissoftworks.com" --ssh ~/.ssh/id_work
gitrole add personal --name "Sara Loera" --email "sara@example.com" --ssh ~/.ssh/id_personal

gitrole use work
gitrole use personal
```

### Client Projects

```bash
gitrole add acme --name "Sara Loera" --email "sara@acme-client.com" --ssh ~/.ssh/id_acme
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

HOME="$TMP_HOME" XDG_CONFIG_HOME="$TMP_HOME/config" node dist/cli/index.js add sara --name "Sara Loera" --email "sara@synthesissoftworks.com"
HOME="$TMP_HOME" XDG_CONFIG_HOME="$TMP_HOME/config" node dist/cli/index.js use sara
HOME="$TMP_HOME" XDG_CONFIG_HOME="$TMP_HOME/config" node dist/cli/index.js current
HOME="$TMP_HOME" XDG_CONFIG_HOME="$TMP_HOME/config" node dist/cli/index.js list
```

## Error Behavior

- Unknown role: exits with code `1`
- Missing `git`: exits with code `1`
- `ssh-add` failure: prints a warning to stderr but still succeeds
- Config file missing: created automatically

## Architecture

The codebase is intentionally split into small layers:

- [src/cli/index.ts](/Users/slodev/Work/gitrole/src/cli/index.ts): Commander wiring and process exit behavior
- [src/application/use-cases.ts](/Users/slodev/Work/gitrole/src/application/use-cases.ts): core application behavior
- [src/domain/role.ts](/Users/slodev/Work/gitrole/src/domain/role.ts): role model and identity matching rules
- [src/adapters/role-store.ts](/Users/slodev/Work/gitrole/src/adapters/role-store.ts): JSON config persistence
- [src/adapters/git-config.ts](/Users/slodev/Work/gitrole/src/adapters/git-config.ts): Git integration
- [src/adapters/ssh-agent.ts](/Users/slodev/Work/gitrole/src/adapters/ssh-agent.ts): SSH key loading
- [src/interface/renderer.ts](/Users/slodev/Work/gitrole/src/interface/renderer.ts): plain-text output rendering

## Notes

- `gitrole` changes global Git config, not per-repository config
- SSH key loading is most useful when your remotes use SSH
- If you work across identities simultaneously, repo-local switching may be a better future enhancement than more global state
