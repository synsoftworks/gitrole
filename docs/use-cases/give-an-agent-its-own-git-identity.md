---
layout: layouts/base.njk
title: Give an agent its own Git identity
eyebrow: Use case
summary: Create a dedicated role, SSH key, and GitHub host alias for an agent so automated commits and pushes stay separate from human identities.
order: 3
---

<h2 id="when-to-use-this">When to use this</h2>

Use this page when you want an agent to work with its own Git identity instead of acting as your personal or work account.

If the agent should reuse an existing work, personal, or client role instead, use <a href="{{ '/use-cases/use-gitrole-as-an-identity-preflight-for-agents-and-automation/' | url }}">Use gitrole as an identity preflight for agents and automation</a> instead of this page.

This is useful when you want:

- automated commits to be clearly separate from human commits
- a dedicated GitHub account for an agent
- a repeatable repository setup for automation
- to avoid mixing your own account with machine-driven work

<h2 id="how-it-works">How it works</h2>

A dedicated agent role gives the automation its own:

- commit name
- commit email
- SSH key
- GitHub account
- GitHub SSH host alias

That means the repository can clearly distinguish:

- human-authored work
- agent-authored work

<h2 id="create-the-agent-role">Create the agent role</h2>

Start by creating a role for the agent:

```bash
gitrole add agent \
  --name "Acme Build Agent" \
  --email "build-agent@acme.example" \
  --ssh ~/.ssh/id_ed25519_agent \
  --github-user acme-build-agent \
  --github-host github.com-acme-build-agent
```

<h2 id="switch-the-repo-to-the-agent-role">Switch the repo to the agent role</h2>

Use the role locally when this repository should use the agent identity:

```bash
gitrole use agent --local
```

If the remote should also use the agent's SSH host alias, update it too:

```bash
gitrole remote set agent
```

<h2 id="check-that-it-worked">Check that it worked</h2>

Run:

```bash
gitrole status
```

Use `status` for the fast daily check.

If something looks wrong, run:

```bash
gitrole doctor
```

Use `doctor` when you need the full explanation for the repository, remote, or SSH auth setup.

<h2 id="why-this-is-useful">Why this is useful</h2>

This setup makes automation easier to reason about:

- agent commits are visibly separate from human commits
- SSH pushes use the agent account instead of your personal account
- repository-local overrides keep the agent identity contained to the repositories that need it

That gives you a cleaner boundary between human work and machine-driven work.

If those repositories also need an explicit preferred-role policy, add <a href="{{ '/guides/use-repo-local-identity-policy-with-gitrole/' | url }}">repo-local identity policy with .gitrole</a> after the agent setup is working.
