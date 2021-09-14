## Display card checkbox

This setting enables or disables displaying checkboxes on cards. `Command` or `CTRL` clicking on the checkbox will [archive](../How%20to/Viewing%20the%20archive.md) the card.

No checkbox (default):

<img alt="Screen Shot 2021-09-13 at 4.02.49 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-13%20at%204.02.49%20PM.png 2x">

With checkbox:

<img alt="Screen Shot 2021-09-13 at 4.00.18 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-13%20at%204.00.18%20PM.png 2x">


## Lane width

This setting controls the width of a Kanban board's columns. By default, the columns are 272 pixels wide.

<img alt="Screen Shot 2021-09-13 at 3.46.53 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-13%20at%203.46.53%20PM.png 2x">

Changing this setting to 400 will result in:

<img alt="Screen Shot 2021-09-13 at 3.48.15 PM.png" srcset="/obsidian-kanban/Assets/Screen%20Shot%202021-09-13%20at%203.48.15%20PM.png 2x">


## Maximum number of archived cards

By default, a Kanban board's [archive](../How%20to/Viewing%20the%20archive.md) will grow infinitely. Setting the maximum number of archived cards will cap the archive at the specified number. 

For example, if `Maximum number of archived cards` is set to `100`, the archive will never contain more than 100 cards. When the archive reaches its maximum, old cards will be deleted as new cards are added.


## New line trigger

By default, `enter` creates a new card, and `shift + enter` creates a new line within a card. This can be changed so that `enter` creates new lines and `shift + enter` creates new cards.


## Note folder

When [Creating new notes from Kanban cards](../How%20to/Creating%20new%20notes%20from%20Kanban%20cards.md), the `Note template` setting determines the folder in which new notes are created.


## Note template

When [Creating new notes from Kanban cards](../How%20to/Creating%20new%20notes%20from%20Kanban%20cards.md), new notes will be pre-populated with the specified note template.

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
