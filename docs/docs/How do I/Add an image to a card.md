## Add an image to a card

Images can be added to cards in two ways.

### Embedding images

Images can be embedded into Kanban cards just like you would in any other obsidian note.

<img alt="Screen Shot 2021-09-16 at 9.15.04 AM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-16%20at%209.15.04%20AM.png 2x">

<img alt="Screen Shot 2021-09-16 at 9.15.47 AM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-16%20at%209.15.47%20AM.png 2x">

### Displaying images from metadata

To add an image to a card, first enable a [Linked page metadata](../Settings/Linked%20page%20metadata.md) key/value, with the key set to the metadata field containing an image. Toggle `Field contains markdown`.

<img alt="Screen Shot How-to-add-metadata-to-card.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%20How-to-add-metadata-to-card.png 2x">

#### Adding image to frontmatter

If the [Linked page metadata](../Settings/Linked%20page%20metadata.md) key you're pulling in is in the linked page's frontmatter, **image embeds must be wrapped in quotes, or contain other text before the embed**. This is a quirk of [YAML](https://help.obsidian.md/Advanced+topics/YAML+front+matter). (See also: [Frontmatter limitations & gotchas](../FAQs/Frontmatter%20limitations%20&%20gotchas.md))

````yaml

---

delivery-notes: "![[LinkToImage.png]]"

---

````

<img alt="Screen Shot How-to-add-image-to-card.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%20How-to-add-image-to-card.png 2x">

#### Adding image to inline metadata

Images can also be added to inline metadata if the [Data View](https://github.com/blacksmithgu/obsidian-dataview) plugin is active. When adding an image via inline metadata, quotes are not required.

````

Lorem ipsum dolor sit amet, consectetur adipiscing elit.

delivery-notes:: ![[LinkToImage.png]]

Pellentesque egestas, nibh et pellentesque ullamcorper, lorem mauris pellentesque tellus, a cursus nunc metus at velit.

````
