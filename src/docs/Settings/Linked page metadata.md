## Linked Page Metadata

This setting allows displaying [frontmatter](https://help.obsidian.md/Advanced+topics/YAML+front+matter) and [Dataview](https://blacksmithgu.github.io/obsidian-dataview/data-annotation/) metadata of the first page linked within a card. Note, there are [[Frontmatter limitations & gotchas]].

For example, say you have this note in your vault:

```
---
demo-field: This is a demo frontmatter field
---

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc eu posuere dolor. Proin ut tortor sagittis, auctor est non, varius nibh. Proin varius leo ac convallis dapibus.

inline-field:: This is a demo inline Dataview field that **contains markdown**

Nullam non efficitur ante. Donec convallis nibh ante, eu auctor felis aliquam id.
```

The metadata keys `demo-field` and `inline-field` can then be added under `Linked Page Metadata`

![[Screen Shot 2021-09-16 at 10.09.02 AM.png]]

If the metadata field contains markdown, it must be specified by toggling `Field contains markdown`

![[Screen Shot 2021-09-16 at 10.09.50 AM.png]]

![[Screen Shot 2021-09-16 at 10.10.15 AM.png]]

The metadata will then be displayed below the card.

![[Screen Shot 2021-09-16 at 10.10.47 AM.png]]