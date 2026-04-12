---
layout: layouts/base.njk
title: Switch Git identities without guessing
eyebrow: Overview
summary: gitrole helps you keep work, personal, and client commits from bleeding into each other. Save a role, switch to it, and check the repo before you commit or push.
---

<div class="button-row">
  <a class="button button-primary" href="#workflow">See the workflow</a>
  <a class="button button-secondary" href="#install">Install after you understand it</a>
</div>

<h2 id="problem">What problem it solves</h2>

If you move between work, personal, freelance, or client repositories, it is easy to use the wrong Git identity without noticing.

<div class="card-grid">
  <div class="surface">
    <span class="eyebrow-inline">Wrong commits</span>
    <h3>Wrong-author commits</h3>
    <p>You meant to commit as your work identity, but Git used your personal name and email.</p>
  </div>
  <div class="surface">
    <span class="eyebrow-inline">Wrong pushes</span>
    <h3>Wrong-account pushes</h3>
    <p>The repo looks right locally, but your SSH setup pushes through the wrong GitHub account.</p>
  </div>
  <div class="surface">
    <span class="eyebrow-inline">Too much manual setup</span>
    <h3>Too much Git config switching</h3>
    <p>You keep editing <code>user.name</code>, <code>user.email</code>, or remotes by hand every time you change codebases.</p>
  </div>
  <div class="surface">
    <span class="eyebrow-inline">What gitrole does</span>
    <h3>One small workflow</h3>
    <p>Save a role, switch the repo to it, then run a quick check before you commit or push.</p>
  </div>
</div>

<h2 id="workflow">How it works</h2>

Do not think of `gitrole` as a system first. Think of it as a simple workflow:

<div class="step-grid">
  <div class="surface">
    <span class="eyebrow-inline">Step 1</span>
    <h3>Save a role</h3>
    <p>Create one saved role per identity, such as <code>work</code>, <code>personal</code>, or <code>client-acme</code>.</p>
  </div>
  <div class="surface">
    <span class="eyebrow-inline">Step 2</span>
    <h3>Switch to it</h3>
    <p>Apply that role globally or only in the repository you are working in.</p>
  </div>
  <div class="surface">
    <span class="eyebrow-inline">Step 3</span>
    <h3>Check before you push</h3>
    <p>Run <code>gitrole status</code> for the fast daily check. Run <code>gitrole doctor</code> when something looks wrong.</p>
  </div>
</div>

<h2 id="example">Tiny real example</h2>

This is the smallest useful flow for a repo that should use a local override:

```bash
gitrole add work --name "Alex Developer" --email "alex@work.example"
gitrole use work --local
gitrole status
```

What that does:

1. Saves a role named `work`
2. Applies it only to the current repository
3. Shows what this repo will actually use before the next commit

If `status` looks clean, you have the basic setup working.

<h2 id="status-vs-doctor">Status vs doctor</h2>

Make this distinction early:

<div class="comparison-grid">
  <div class="surface">
    <span class="eyebrow-inline">Fast daily check</span>
    <h3><code>gitrole status</code></h3>
    <p>Use this before you commit or push. It answers "does this repo look right?" without a lot of detail.</p>
  </div>
  <div class="surface">
    <span class="eyebrow-inline">Full explanation</span>
    <h3><code>gitrole doctor</code></h3>
    <p>Use this when the repo looks wrong, pushes use the wrong account, or you need to understand what is out of sync.</p>
  </div>
</div>

> `gitrole` warns on violated expectations, not assumptions. `githubUser` checks SSH auth, `githubHost` checks the remote host, and remote owner/repository is context by default.

<h2 id="install">Install</h2>

Install comes after understanding, not before:

```bash
npm install -g gitrole
```

Then create your first role and run the three-command example above.

<h2 id="command-surface">Command quick reference</h2>

The current command surface is small:

<dl class="command-list">
  <dt><code>gitrole resolve</code></dt>
  <dd>Print the repo-local default role from <code>.gitrole</code>.</dd>
  <dt><code>gitrole use &lt;name&gt; [--global | --local]</code></dt>
  <dd>Apply a saved role globally or to the current repository.</dd>
  <dt><code>gitrole current</code></dt>
  <dd>Show the effective identity right now.</dd>
  <dt><code>gitrole status</code></dt>
  <dd>Show the fast human-readable alignment check.</dd>
  <dt><code>gitrole status --short</code></dt>
  <dd>Show the one-line machine-friendly alignment check.</dd>
  <dt><code>gitrole doctor</code></dt>
  <dd>Explain identity, remote, and SSH auth alignment in more detail.</dd>
  <dt><code>gitrole doctor --json</code></dt>
  <dd>Return the full diagnostic result as JSON.</dd>
  <dt><code>gitrole remote set &lt;name&gt;</code></dt>
  <dd>Rewrite <code>origin</code> to the saved role's GitHub SSH host alias.</dd>
</dl>

<h2 id="keep-reading">Guides and use cases</h2>

Use the guide when you want the standard setup. Use a use case when you already know the basic workflow and need help with one specific problem.

<div class="link-grid">
  <a class="reference-card" href="{{ '/guides/use-the-right-git-identity-for-this-repo/' | url }}">
    <div>
      <strong>Guide: Use the right Git identity for this repo</strong>
      <span>Start here if you want the normal setup for one repository.</span>
    </div>
    <span aria-hidden="true">&rarr;</span>
  </a>
  <a class="reference-card" href="{{ '/guides/use-repo-local-identity-policy-with-gitrole/' | url }}">
    <div>
      <strong>Guide: Use repo-local identity policy with .gitrole</strong>
      <span>Declare the preferred role for a repo and the short list of roles that are still valid there.</span>
    </div>
    <span aria-hidden="true">&rarr;</span>
  </a>
  <a class="reference-card" href="{{ '/use-cases/fix-pushes-using-the-wrong-github-account/' | url }}">
    <div>
      <strong>Use case: Fix pushes using the wrong GitHub account</strong>
      <span>Work through the repo, remote, and SSH checks when pushes go to the wrong account.</span>
    </div>
    <span aria-hidden="true">&rarr;</span>
  </a>
  <a class="reference-card" href="{{ '/use-cases/use-gitrole-as-an-identity-preflight-for-agents-and-automation/' | url }}">
    <div>
      <strong>Use case: Use gitrole as an identity preflight for agents and automation</strong>
      <span>Check repo identity state before an agent commits or pushes under an existing role.</span>
    </div>
    <span aria-hidden="true">&rarr;</span>
  </a>
  <a class="reference-card" href="{{ '/use-cases/give-an-agent-its-own-git-identity/' | url }}">
    <div>
      <strong>Use case: Give an agent its own Git identity</strong>
      <span>Keep automated commits and pushes separate from human identities.</span>
    </div>
    <span aria-hidden="true">&rarr;</span>
  </a>
</div>

<h2 id="repo-policy">Repo-local identity policy</h2>

If a repository has a root-level <code>.gitrole</code> file, <code>gitrole</code> can
tell you which role is preferred there and which roles are still allowed.

```json
{
  "version": 1,
  "defaultRole": "company-main",
  "allowedRoles": ["company-main", "maintainer-personal"]
}
```

Use <code>gitrole resolve</code> when you want the repo's preferred role:

```bash
gitrole resolve
```

This is repo-local identity policy, not full workflow management. It does not
auto-switch roles, install hooks, or block commits.
