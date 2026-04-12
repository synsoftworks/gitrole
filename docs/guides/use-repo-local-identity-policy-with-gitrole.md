---
layout: layouts/base.njk
title: Use repo-local identity policy with .gitrole
eyebrow: Guide
summary: Teach a repository which roles belong there, show the preferred role, and let status and doctor explain whether the current role fits the repo.
order: 2
---

<h2 id="what-this-is">What this is</h2>

Use a root-level <code>.gitrole</code> file when a repository should declare:

- which role is preferred there
- which roles are still allowed there

This is repo-local identity policy, not workflow automation. It does not switch roles for you, install hooks, or block commits.

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

If no <code>.gitrole</code> file exists, <code>resolve</code> fails clearly, and <code>status</code> and <code>doctor</code> behave as normal.

<h2 id="how-status-and-doctor-use-policy">How status and doctor use policy</h2>

When <code>.gitrole</code> exists, <code>gitrole status</code> and <code>gitrole doctor</code> layer repo policy on top of the normal identity, remote, and SSH checks.

The policy states are simple:

- <code>ok</code>: the effective role matches <code>defaultRole</code>
- <code>info</code>: the effective role is allowed here, but it is not the default
- <code>warn</code>: the effective role is not in <code>allowedRoles</code>

Allowed-but-not-default does not degrade the repo to warning by itself.

<h2 id="shared-repo-example">Shared repo example</h2>

This is useful for a shared org repository where both the org identity and a personal maintainer identity are valid:

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
- the repo can still be aligned
- policy is surfaced as <code>info</code>, not <code>warn</code>

<h2 id="when-to-use-it">When to use it</h2>

Add <code>.gitrole</code> when a repository has an identity policy you want to make explicit, such as:

- a company repo that should normally use a work role
- a shared repo where more than one role is valid
- an open-source repo where a maintainer identity is allowed but not always the default

Keep it small. If all you need is "what role belongs here?" and "is this role allowed here?", <code>.gitrole</code> is enough.
