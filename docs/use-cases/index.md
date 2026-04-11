---
layout: layouts/base.njk
title: Use Cases
eyebrow: Use cases
summary: Use cases are focused scenarios for developers who already understand the basic workflow and need help with a specific problem.
---

<h2 id="available-use-cases">Available use cases</h2>

{% for entry in collections.useCases %}
<a class="reference-card" href="{{ entry.url | url }}">
  <div>
    <strong>{{ entry.data.title }}</strong>
    <span>{{ entry.data.summary }}</span>
  </div>
  <span aria-hidden="true">&rarr;</span>
</a>
{% endfor %}
