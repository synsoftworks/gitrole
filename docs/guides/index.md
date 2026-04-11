---
layout: layouts/base.njk
title: Guides
eyebrow: Guides
summary: Start with the basic workflow guides if you are new to gitrole. They are written to get one repository working before you move into edge cases.
---

<h2 id="available-guides">Available guides</h2>

{% for entry in collections.guides %}
<a class="reference-card" href="{{ entry.url | url }}">
  <div>
    <strong>{{ entry.data.title }}</strong>
    <span>{{ entry.data.summary }}</span>
  </div>
  <span aria-hidden="true">&rarr;</span>
</a>
{% endfor %}
