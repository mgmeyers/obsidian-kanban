## Add date and time to archived cards

When active, a time stamp will be added to cards when they are archived. This will be added to the beginning of the card, and can be separated from the card's content using the [Archive date time separator](Archive%20date%20time%20separator.md) setting. The date format can be controlled with the [Archive date time format](Archive%20date%20time%20format.md) setting.

<img alt="Screen Shot 2021-09-15 at 7.04.26 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-15%20at%207.04.26%20PM.png 2x">


## Archive date time format

This will set the format of the [archive timestamp](Add%20date%20and%20time%20to%20archived%20cards.md). Available formatting options can be found [here](https://momentjs.com/docs/#/displaying/format/)

<img alt="Screen Shot 2021-09-15 at 7.08.08 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-15%20at%207.08.08%20PM.png 2x">

<img alt="Screen Shot 2021-09-15 at 7.09.08 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-15%20at%207.09.08%20PM.png 2x">


## Archive date time separator

This will be used to separate the [archive timestamp](Add%20date%20and%20time%20to%20archived%20cards.md) from a card's content.

Setting the separator:

<img alt="Screen Shot 2021-09-15 at 7.06.15 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-15%20at%207.06.15%20PM.png 2x">

Resulting archived card:

<img alt="Screen Shot 2021-09-15 at 7.06.48 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-15%20at%207.06.48%20PM.png 2x">


## Board header buttons

These settings allow hiding buttons from a Kanban board's header.

Default:

<img alt="Screen Shot 2021-09-14 at 11.55.06 AM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-14%20at%2011.55.06%20AM.png 2x">

With the "Add a list" button hidden:

<img alt="Screen Shot 2021-09-14 at 11.56.01 AM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-14%20at%2011.56.01%20AM.png 2x">


## Date display format

The date display format is similar to the [Date format](Date%20format.md) except that it controls the format of the date shown at the bottom of a card. This date can be hidden using the [Hide card display dates](Hide%20card%20display%20dates.md) setting. Available formatting options can be found [here](https://momentjs.com/docs/#/displaying/format/)

Setting the date display format:

<img alt="Screen Shot 2021-09-15 at 5.46.58 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-15%20at%205.46.58%20PM.png 2x">

Creating a card with a date in the current [Date format](Date%20format.md):

<img alt="Screen Shot 2021-09-15 at 5.48.37 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-15%20at%205.48.37%20PM.png 2x">

By default, the date is hidden from the card text (see: [Hide dates in card titles](Hide%20dates%20in%20card%20titles.md)) and displayed using the date display format below:

<img alt="Screen Shot 2021-09-15 at 5.48.16 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-15%20at%205.48.16%20PM.png 2x">


## Date format

Allows specifying the output of the [calendar popup](Date%20trigger.md). Available formatting options can be found [here](https://momentjs.com/docs/#/displaying/format/)

`YYYY-MM-DD`:

<img alt="Screen Shot 2021-09-14 at 12.08.25 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-14%20at%2012.08.25%20PM.png 2x">

`ddd, MMM Do, YYYY`:

<img alt="Screen Shot 2021-09-14 at 12.09.20 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-14%20at%2012.09.20%20PM.png 2x">


## Date trigger

When creating or editing a card, this character—`@` by default—or sequence of characters will trigger the calendar popup.

<img alt="Screen Shot 2021-09-14 at 12.01.07 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-14%20at%2012.01.07%20PM.png 2x">


## Display card checkbox

This setting enables or disables displaying checkboxes on cards. `Command` or `CTRL` clicking on the checkbox will [archive](../How%20do%20I/View%20a%20Kanban's%20archive.md) the card.

No checkbox (default):

<img alt="Screen Shot 2021-09-13 at 4.02.49 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-13%20at%204.02.49%20PM.png 2x">

With checkbox:

<img alt="Screen Shot 2021-09-13 at 4.00.18 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-13%20at%204.00.18%20PM.png 2x">


## Hide card display dates

This setting hides display dates (see: [Date display format](Date%20display%20format.md)). This setting is designed to be used in conjuction with [Hide dates in card titles](Hide%20dates%20in%20card%20titles.md).

Off: 

<img alt="Screen Shot 2021-09-15 at 5.48.16 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-15%20at%205.48.16%20PM.png 2x">

On:

<img alt="Screen Shot 2021-09-15 at 5.51.36 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-15%20at%205.51.36%20PM.png 2x">


## Hide card display tags

This setting will display any tags within a card's content at the bottom of the card. It can be used in conjunction with [Hide tags in card titles](Hide%20tags%20in%20card%20titles.md) for improved organization and aesthetics.

Off:

<img alt="Screen Shot 2021-09-15 at 6.04.57 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-15%20at%206.04.57%20PM.png 2x">

On:

<img alt="Screen Shot 2021-09-15 at 6.05.21 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-15%20at%206.05.21%20PM.png 2x">


## Hide dates in card titles

Hide dates from the main card text. This setting is designed to be used in conjunction with [Hide card display dates](Hide%20card%20display%20dates.md). It can also be used to show links to [daily notes](Link%20dates%20to%20daily%20notes.md) in the card's text.

Off:

<img alt="Screen Shot 2021-09-15 at 5.54.15 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-15%20at%205.54.15%20PM.png 2x">

On (default):

<img alt="Screen Shot 2021-09-15 at 5.48.16 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-15%20at%205.48.16%20PM.png 2x">


## Hide tags in card titles

By default, tags will display in a card's main text. This setting allows you to visually remove tags from this text. Tags still remain, but are not displayed. This setting is meant to be used in conjunction with the [Hide card display tags](Hide%20card%20display%20tags.md) setting.

Setting off:

<img alt="Screen Shot 2021-09-14 at 11.44.32 AM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-14%20at%2011.44.32%20AM.png 2x">

Setting on:

<img alt="Screen Shot 2021-09-14 at 11.49.10 AM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-14%20at%2011.49.10%20AM.png 2x">


## Lane width

This setting controls the width of a Kanban board's columns. By default, the columns are 272 pixels wide.

<img alt="Screen Shot 2021-09-13 at 3.46.53 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-13%20at%203.46.53%20PM.png 2x">

Changing this setting to 400 will result in:

<img alt="Screen Shot 2021-09-13 at 3.48.15 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-13%20at%203.48.15%20PM.png 2x">


## Link dates to daily notes

When this setting is active, dates and [display dates](Date%20display%20format.md) will link to the corresponding daily note.

<img alt="Screen Shot 2021-09-15 at 6.53.47 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-15%20at%206.53.47%20PM.png 2x">

<img alt="Screen Shot 2021-09-15 at 6.54.29 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-15%20at%206.54.29%20PM.png 2x">


## Linked Page Metadata

This setting allows displaying [frontmatter](https://help.obsidian.md/Advanced+topics/YAML+front+matter) and [Dataview](https://blacksmithgu.github.io/obsidian-dataview/data-annotation/) metadata of the first page linked within a card. Note, there are [Frontmatter limitations & gotchas](../FAQs/Frontmatter%20limitations%20&%20gotchas.md).

For example, say you have this note in your vault:

````
---
demo-field: This is a demo frontmatter field
---

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc eu posuere dolor. Proin ut tortor sagittis, auctor est non, varius nibh. Proin varius leo ac convallis dapibus.

inline-field:: This is a demo inline Dataview field that **contains markdown**

Nullam non efficitur ante. Donec convallis nibh ante, eu auctor felis aliquam id.
````

The metadata keys `demo-field` and `inline-field` can then be added under `Linked Page Metadata`

<img alt="Screen Shot 2021-09-16 at 10.09.02 AM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-16%20at%2010.09.02%20AM.png 2x">

If the metadata field contains markdown, it must be specified by toggling `Field contains markdown`

<img alt="Screen Shot 2021-09-16 at 10.09.50 AM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-16%20at%2010.09.50%20AM.png 2x">

<img alt="Screen Shot 2021-09-16 at 10.10.15 AM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-16%20at%2010.10.15%20AM.png 2x">

The metadata will then be displayed below the card.

<img alt="Screen Shot 2021-09-16 at 10.10.47 AM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-16%20at%2010.10.47%20AM.png 2x">


## Local vs. global settings

The settings for the Kanban plugin can be set globally, as well as on a per-board basis. Global settings can be found in `Settings > Kanban`.

<img alt="Screen Shot 2021-09-16 at 1.04.58 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-16%20at%201.04.58%20PM.png 2x">

Global settings can be overridden on a per-board basis by modifying the board's settings, which can be accessed through the [Board header buttons](Board%20header%20buttons.md) or the `More options menu`.

<img alt="Screen Shot 2021-09-16 at 1.06.02 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-16%20at%201.06.02%20PM.png 2x">

<img alt="Screen Shot 2021-09-16 at 1.06.27 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-16%20at%201.06.27%20PM.png 2x">


## Maximum number of archived cards

By default, a Kanban board's [archive](../How%20do%20I/View%20a%20Kanban's%20archive.md) will grow infinitely. Setting the maximum number of archived cards will cap the archive at the specified number. 

For example, if `Maximum number of archived cards` is set to `100`, the archive will never contain more than 100 cards. When the archive reaches its maximum, old cards will be deleted as new cards are added.


## New line trigger

By default, `enter` creates a new card, and `shift + enter` creates a new line within a card. This can be changed so that `enter` creates new lines and `shift + enter` creates new cards.


## Note folder

When [Create notes from cards](../How%20do%20I/Create%20notes%20from%20cards.md), the `Note template` setting determines the folder in which new notes are created.


## Note template

When [Create notes from cards](../How%20do%20I/Create%20notes%20from%20cards.md), new notes will be pre-populated with the specified note template.

Supported template formats:

* [Obsidian Templates](https://help.obsidian.md/Plugins/Templates)
* [Templater](https://silentvoid13.github.io/Templater/)

### Example

With the Obsidian core template plugin active (`Settings > Core plugins > Templates`) create a new note called `Demo Template` in your vault containing:

````
# {{title}}

This file was created on {{date}} {{time}}.
````

Then select the template in your Kanban board's settings:

<img alt="Screen Shot 2021-09-13 at 3.32.18 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-13%20at%203.32.18%20PM.png 2x">

<img alt="Screen Shot 2021-09-13 at 3.35.03 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-13%20at%203.35.03%20PM.png 2x">

<img alt="Screen Shot 2021-09-13 at 3.35.17 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-13%20at%203.35.17%20PM.png 2x">


## Prepend / append new cards

This setting changes where new cards are inserted into a list, and also where the `Add a card` button is placed. New cards are appended to the list by default.

### Append

<img alt="Screen Shot 2021-09-13 at 12.22.08 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-13%20at%2012.22.08%20PM.png 2x">

### Prepend

<img alt="Screen Shot 2021-09-13 at 12.22.57 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-13%20at%2012.22.57%20PM.png 2x">

### Prepend (compact)

<img alt="Screen Shot 2021-09-13 at 12.23.35 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-13%20at%2012.23.35%20PM.png 2x">


## Show relative date

When this setting is active, cards will display the number of days between the current date and the date contained in a card. 

<img alt="Screen Shot 2021-09-15 at 6.59.29 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-15%20at%206.59.29%20PM.png 2x">


## Time format

Allows specifying the output of the [time selection popup](Time%20trigger.md). Available formatting options can be found [here](https://momentjs.com/docs/#/displaying/format/)

`HH:mm`:

<img alt="Screen Shot 2021-09-14 at 12.12.29 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-14%20at%2012.12.29%20PM.png 2x">

`h:mm a`:

<img alt="Screen Shot 2021-09-14 at 12.13.07 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-14%20at%2012.13.07%20PM.png 2x">


## Time trigger

When creating or editing a card, this character or sequence of characters—`@@` by default—will trigger the time selection popup.

<img alt="Screen Shot 2021-09-14 at 12.03.06 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-14%20at%2012.03.06%20PM.png 2x">
