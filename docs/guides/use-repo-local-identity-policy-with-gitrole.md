---
layout: layouts/base.njk
title: Use repo-local identity policy with .gitrole
eyebrow: Guide
summary: Declare the preferred and allowed Git roles for a repository.
order: 2
---

<h2 id="what-this-is">What this is</h2>

Use a root-level <code>.gitrole</code> file when a repository should say:

- "this role is the normal one here"
- "these roles are still okay here"

This is repo-local identity policy, not workflow automation.

It does not:

- switch roles for you
- install hooks
- block commits

It just gives the repo a small, clear identity rule.

<h2 id="pin-a-repo-to-one-role">Pin a repo to one role</h2>

If a repo should use exactly one saved role most of the time, this is the easiest path:

```bash
gitrole pin company-main
```

That creates a <code>.gitrole</code> file like this:

```json
{
  "version": 1,
  "defaultRole": "company-main",
  "allowedRoles": ["company-main"]
}
```

Think of <code>pin</code> as saying:

- this repo belongs to <code>company-main</code>
- do not guess
- do not allow extra roles unless someone edits the policy on purpose

If <code>.gitrole</code> already exists, <code>gitrole pin</code> fails on purpose. It will not merge, overwrite, or silently expand the policy.

<h2 id="the-file-format">The file format</h2>

The first version is intentionally small:

```json
{
  "version": 1,
  "defaultRole": "company-main",
  "allowedRoles": ["company-main", "maintainer-personal"]
}
```

What each field means:

- <code>defaultRole</code> is the role that normally belongs in this repo
- <code>allowedRoles</code> is the short list of roles that are still valid here

The default role must also appear in <code>allowedRoles</code>.

<h2 id="resolve-the-default-role">Resolve the default role</h2>

Run this inside the repository:

```bash
gitrole resolve
```

If the repo has a valid <code>.gitrole</code> file, <code>resolve</code> prints the <code>defaultRole</code>.

Example:

```text
company-main
```

If you want the whole policy as JSON for scripts, prompts, or agents, use:

```bash
gitrole resolve --json
```

Example:

```json
{
  "version": 1,
  "defaultRole": "company-main",
  "allowedRoles": ["company-main", "maintainer-personal"]
}
```

If no <code>.gitrole</code> file exists, <code>resolve</code> fails clearly. <code>status</code> and <code>doctor</code> still work normally without repo policy.

<h2 id="how-status-and-doctor-use-policy">How status and doctor use policy</h2>

When <code>.gitrole</code> exists, <code>gitrole status</code> and <code>gitrole doctor</code> add repo policy on top of the normal identity, remote, and SSH checks.

The policy states are simple:

- <code>ok</code>: the effective role matches <code>defaultRole</code>
- <code>info</code>: the effective role is allowed here, but it is not the default
- <code>warn</code>: the effective role is not in <code>allowedRoles</code>

Allowed-but-not-default does not degrade the repo to warning by itself.

<h2 id="shared-repo-example">Shared repo example</h2>

This is useful for a shared org repo where both the org identity and a maintainer's personal identity are valid:

```json
{
  "version": 1,
  "defaultRole": "company-main",
  "allowedRoles": ["company-main", "maintainer-personal"]
}
```

If you are currently using <code>maintainer-personal</code>, the repo can still be aligned.

Example status output:

```text
maintainer-personal  Maintainer Name <maintainer@personal.example>  global  aligned
repo policy  allowed role maintainer-personal (default: company-main)
```

Example doctor interpretation:

- remote and SSH auth can still be correct
- policy is surfaced as <code>info</code>, not <code>warn</code>, because the current role is allowed even though it is not the default

<h2 id="when-to-use-it">When to use it</h2>

Add <code>.gitrole</code> when a repository has an identity policy you want to make explicit, such as:

- a company repo that should normally use a work role
- a shared repo where more than one role is valid
- an open-source repo where a maintainer identity is allowed but not always the default

Keep it small.

Use <code>.gitrole</code> when you want the repo to answer two simple questions:

- what role is preferred here?
- is the current role allowed here?
