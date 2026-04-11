---
layout: layouts/base.njk
title: Use the right Git identity for this repo
eyebrow: Guide
summary: Save one role per identity, switch this repo to the right one, and check that commits and pushes will use the account you expect.
order: 1
---

<h2 id="what-this-solves">What this solves</h2>

If you work across personal, work, freelance, or client repositories, it is easy to commit with the wrong name and email or push through the wrong GitHub account.

`gitrole` gives you a short workflow:

1. Save an identity as a role
2. Switch this repo to that role
3. Check that the repo is using the right identity before you commit or push

<h2 id="save-a-role">Save a role</h2>

Start by saving a role for the identity you want to use:

```bash
gitrole add work \
  --name "Alex Developer" \
  --email "alex@work.example"
```

A role is just a saved Git identity.

If this identity also uses a separate SSH key and GitHub account, add those too:

```bash
gitrole add work \
  --name "Alex Developer" \
  --email "alex@work.example" \
  --ssh ~/.ssh/id_work \
  --github-user acme-dev \
  --github-host github.com-acme-dev
```

<h2 id="switch-this-repo">Switch this repo to that role</h2>

Use `--local` when you want this repository to use that identity without changing the rest of your machine:

```bash
gitrole use work --local
```

Example output:

```text
switched to work
  scope local
  name  Alex Developer
  email alex@work.example
```

Use global mode only when you want to change your machine-wide Git identity:

```bash
gitrole use work
```

<h2 id="check-the-repo">Check the repo before you commit</h2>

After switching, run:

```bash
gitrole status
```

This is the fast daily check. It tells you what this repo will actually use.

Example:

```text
work  Alex Developer <alex@work.example>  local override  aligned
last non-merge commit  Alex Developer <alex@work.example> - fix login form
```

That tells you:

- this repo is using the `work` role
- the role is applied locally in this repo
- the repo looks aligned
- the most recent non-merge commit was also authored with the same identity

<h2 id="if-something-looks-wrong">If something looks wrong</h2>

Run:

```bash
gitrole doctor
```

Use `doctor` when you want the full explanation.

That is the command to reach for when:

- a repo is using the wrong identity
- pushes go through the wrong GitHub account
- the remote uses the wrong SSH host alias
- `status` does not look clean

If each identity has its own GitHub SSH alias, `gitrole` can update `origin` to the right one:

```bash
gitrole remote set work
```

That rewrites the repository remote to the host alias configured for that role.

<h2 id="simple-setup">A simple setup that works well</h2>

A reliable setup usually looks like this:

- one `gitrole` role per identity
- one SSH host alias per GitHub account
- `gitrole use <role> --local` inside repos that should stay isolated
- `gitrole status` before you commit or push

If your work account uses its own SSH key, add an alias in `~/.ssh/config`:

```sshconfig
Host github.com-acme-dev
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_work
  IdentitiesOnly yes
```

Then save a matching `gitrole` role with:

- `--ssh ~/.ssh/id_work`
- `--github-host github.com-acme-dev`
- `--github-user acme-dev`

The short version:

```bash
gitrole add work --name "Alex Developer" --email "alex@work.example"
gitrole use work --local
gitrole status
```

That is the basic `gitrole` workflow.
