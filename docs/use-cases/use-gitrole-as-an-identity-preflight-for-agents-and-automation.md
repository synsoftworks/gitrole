---
layout: layouts/base.njk
title: Use gitrole as an identity preflight for agents and automation
eyebrow: Use case
summary: Use gitrole to check repository identity state before an agent commits or pushes, especially when the agent should act under an existing work, personal, or client role.
order: 2
---

<h2 id="when-to-use-this">When to use this</h2>

Use this page when an agent or automation should work under an existing role instead of using its own dedicated Git identity.

This is useful when:

- the repository already has a role like <code>work</code>, <code>personal</code>, or <code>client-acme</code>
- the agent should verify identity state before it commits or pushes
- you want a machine-readable preflight check in automation
- you want to catch the wrong role, host alias, or SSH account before a push happens

<h2 id="what-the-agent-should-check">What the agent should check</h2>

For automation, the goal is not to explain every detail. The goal is to answer one question before a write:

Is this repository about to use the identity I expect?

In practice, that means checking:

- the effective commit identity
- whether the role is applied locally or globally
- whether the remote host matches the expected GitHub host alias
- whether SSH auth resolves to the expected GitHub user

<h2 id="run-a-fast-preflight-check">Run a fast preflight check</h2>

Use the one-line status view when you want a compact automation-friendly signal:

```bash
gitrole status --short
```

This is the right default when the agent only needs to know whether the repository looks aligned before it continues.

<h2 id="use-doctor-for-the-full-explanation">Use doctor for the full explanation</h2>

When the quick check is not clean, ask for the full diagnosis:

```bash
gitrole doctor --json
```

This is the better choice when an agent needs structured detail about:

- the active role
- local versus global config
- remote configuration
- SSH auth results
- the checks that actually triggered a warning

<h2 id="a-practical-flow">A practical flow</h2>

A practical automation flow looks like this:

```bash
gitrole use work --local
gitrole status --short
gitrole doctor --json
```

Use the first command only if the automation is responsible for selecting the role. If the repository should already be configured, start with <code>status --short</code>.

<h2 id="when-to-use-this-vs-a-dedicated-agent-role">When to use this vs a dedicated agent role</h2>

Use this page when the automation should safely act under an existing role.

Use the dedicated agent identity flow when the automation should have its own:

- commit name and email
- SSH key
- GitHub account
- host alias

That is a different setup, and it belongs in <a href="{{ '/use-cases/give-an-agent-its-own-git-identity/' | url }}">Give an agent its own Git identity</a>.
