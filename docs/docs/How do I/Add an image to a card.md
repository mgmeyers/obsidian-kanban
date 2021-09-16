## Add an image to a card
### How to add an image to a card
#### Enabling linked page metadata
To add an image to a card, please first enable a linked page metadata key/value in the obsidian-kanban settings like shown below.

<img alt="How-to-add-metadata-to-card.png" srcset="/obsidian-kanban/Assets/How-to-add-image-to-card.png 2x">

#### Adding image to linked page metadata

After you've setup your linked page metadata, you can paste an image into metadata like below.

```yaml
---
delivery-notes: "[[LinkToImage.png]]"
---
```


<img alt="How-to-add-image-to-card.png" srcset="/obsidian-kanban/Assets/How-to-add-image-to-card.png 2x">



### Current YAML Metadata Bug & Workaround
At the moment there must be some form of **text before the image** otherwise the preview will not render correctly. For example, the below will *not* work.

```yaml
---
delivery-notes: [[LinkToImage.png]]
---
```

But the two examples below should still display the image correctly.

```yaml
---
delivery-notes: qwerty[[LinkToImage.png]]
---
```

```yaml
---
delivery-notes: "[[LinkToImage.png]]"
---
```
