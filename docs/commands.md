---
layout: layouts/base.njk
title: Commands
eyebrow: Reference
summary: The current gitrole command surface, with the short purpose of each command.
---

<h2 id="command-list">Command list</h2>

<dl class="command-list">
  <dt><code>gitrole add &lt;name&gt; --name "..." --email "..." [--ssh ...] [--github-user ...] [--github-host ...]</code></dt>
  <dd>Create or update a saved role profile.</dd>

  <dt><code>gitrole use &lt;name&gt; [--global | --local]</code></dt>
  <dd>Apply a saved role globally or only in the current repository.</dd>

  <dt><code>gitrole resolve</code></dt>
  <dd>Print the repo-local default role from <code>.gitrole</code>.</dd>

  <dt><code>gitrole current</code></dt>
  <dd>Show which saved role matches the current effective commit identity.</dd>

  <dt><code>gitrole list</code></dt>
  <dd>List all saved roles and mark the active one when there is a match.</dd>

  <dt><code>gitrole status</code></dt>
  <dd>Show the fast human-readable alignment check for the current repository.</dd>

  <dt><code>gitrole status --short</code></dt>
  <dd>Show the one-line machine-friendly alignment check.</dd>

  <dt><code>gitrole doctor</code></dt>
  <dd>Explain commit identity, remote configuration, and SSH auth alignment in more detail.</dd>

  <dt><code>gitrole doctor --json</code></dt>
  <dd>Return the full diagnosis as structured JSON.</dd>

  <dt><code>gitrole remote set &lt;name&gt;</code></dt>
  <dd>Rewrite <code>origin</code> to the GitHub SSH host alias configured for the saved role.</dd>

  <dt><code>gitrole remove &lt;name&gt;</code></dt>
  <dd>Remove a saved role profile.</dd>
</dl>
