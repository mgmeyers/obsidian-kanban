
Images can be added to cards in two ways.

### Embedding images

Images can be embedded into Kanban cards just like you would in any other obsidian note.

![[Screen Shot 2021-09-16 at 9.15.04 AM.png]]

![[Screen Shot 2021-09-16 at 9.15.47 AM.png]]

### Displaying images from metadata

To add an image to a card, first enable a [[Linked page metadata]] key/value, with the key set to the metadata field containing an image. Toggle `Field contains markdown`.

![[Screen Shot How-to-add-metadata-to-card.png]]
  
#### Adding image to frontmatter

If the [[Linked page metadata]] key you're pulling in is in the linked page's frontmatter, **image embeds must be wrapped in quotes, or contain other text before the embed**. This is a quirk of [YAML](https://help.obsidian.md/Advanced+topics/YAML+front+matter). (See also: [[Frontmatter limitations & gotchas]])
  
```yaml

---

delivery-notes: "![[LinkToImage.png]]"

---

```

![[Screen Shot How-to-add-image-to-card.png]]

#### Adding image to inline metadata

Images can also be added to inline metadata if the [Data View](https://github.com/blacksmithgu/obsidian-dataview) plugin is active. When adding an image via inline metadata, quotes are not required.

```markdown
Lorem ipsum dolor sit amet, consectetur adipiscing elit.

delivery-notes:: ![[LinkToImage.png]]

Pellentesque egestas, nibh et pellentesque ullamcorper, lorem mauris pellentesque tellus, a cursus nunc metus at velit.

```
