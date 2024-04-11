// English

export default {
  // main.ts
  'Open as kanban board': 'Open as kanban board',
  'Create new board': 'Create new board',
  'Archive completed cards in active board':
    'Archive completed cards in active board',
  'Error: current file is not a Kanban board':
    'Error: current file is not a Kanban board',
  'Convert empty note to Kanban': 'Convert empty note to Kanban',
  'Error: cannot create Kanban, the current note is not empty':
    'Error: cannot create Kanban, the current note is not empty',
  'New kanban board': 'New kanban board',
  'Untitled Kanban': 'Untitled Kanban',
  'Toggle between Kanban and markdown mode':
    'Toggle between Kanban and markdown mode',

  // KanbanView.tsx
  'Open as markdown': 'Open as markdown',
  'Open board settings': 'Open board settings',
  'Archive completed cards': 'Archive completed cards',
  'Something went wrong': 'Something went wrong',
  'You may wish to open as markdown and inspect or edit the file.':
    'You may wish to open as markdown and inspect or edit the file.',
  'Are you sure you want to archive all completed cards on this board?':
    'Are you sure you want to archive all completed cards on this board?',

  // parser.ts
  Complete: 'Complete',
  Archive: 'Archive',
  'Invalid Kanban file: problems parsing frontmatter':
    'Invalid Kanban file: problems parsing frontmatter',
  "I don't know how to interpret this line:":
    "I don't know how to interpret this line:",
  Untitled: 'Untitled', // auto-created column

  // settingHelpers.ts
  'Note: No template plugins are currently enabled.':
    'Note: No template plugins are currently enabled.',
  default: 'default',
  'Search...': 'Search...',

  // Settings.ts
  'New line trigger': 'New line trigger',
  'Select whether Enter or Shift+Enter creates a new line. The opposite of what you choose will create and complete editing of cards and lists.':
    'Select whether Enter or Shift+Enter creates a new line. The opposite of what you choose will create and complete editing of cards and lists.',
  'Shift + Enter': 'Shift + Enter',
  Enter: 'Enter',
  'Prepend / append new cards': 'Prepend / append new cards',
  'This setting controls whether new cards are added to the beginning or end of the list.':
    'This setting controls whether new cards are added to the beginning or end of the list.',
  Prepend: 'Prepend',
  'Prepend (compact)': 'Prepend (compact)',
  Append: 'Append',
  'These settings will take precedence over the default Kanban board settings.':
    'These settings will take precedence over the default Kanban board settings.',
  'Set the default Kanban board settings. Settings can be overridden on a board-by-board basis.':
    'Set the default Kanban board settings. Settings can be overridden on a board-by-board basis.',
  'Note template': 'Note template',
  'This template will be used when creating new notes from Kanban cards.':
    'This template will be used when creating new notes from Kanban cards.',
  'No template': 'No template',
  'Note folder': 'Note folder',
  'Notes created from Kanban cards will be placed in this folder. If blank, they will be placed in the default location for this vault.':
    'Notes created from Kanban cards will be placed in this folder. If blank, they will be placed in the default location for this vault.',
  'Default folder': 'Default folder',
  'List width': 'List width',
  'Enter a number to set the list width in pixels.':
    'Enter a number to set the list width in pixels.',
  'Maximum number of archived cards': 'Maximum number of archived cards',
  "Archived cards can be viewed in markdown mode. This setting will begin removing old cards once the limit is reached. Setting this value to -1 will allow a board's archive to grow infinitely.":
    "Archived cards can be viewed in markdown mode. This setting will begin removing old cards once the limit is reached. Setting this value to -1 will allow a board's archive to grow infinitely.",
  'Display card checkbox': 'Display card checkbox',
  'When toggled, a checkbox will be displayed with each card':
    'When toggled, a checkbox will be displayed with each card',
  'Reset to default': 'Reset to default',
  'Date & Time': 'Date & Time',
  'Date trigger': 'Date trigger',
  'When this is typed, it will trigger the date selector':
    'When this is typed, it will trigger the date selector',
  'Time trigger': 'Time trigger',
  'When this is typed, it will trigger the time selector':
    'When this is typed, it will trigger the time selector',
  'Date format': 'Date format',
  'This format will be used when saving dates in markdown.':
    'This format will be used when saving dates in markdown.',
  'For more syntax, refer to': 'For more syntax, refer to',
  'format reference': 'format reference',
  'Your current syntax looks like this': 'Your current syntax looks like this',
  'Time format': 'Time format',
  'Date display format': 'Date display format',
  'This format will be used when displaying dates in Kanban cards.':
    'This format will be used when displaying dates in Kanban cards.',
  'Show relative date': 'Show relative date',
  "When toggled, cards will display the distance between today and the card's date. eg. 'In 3 days', 'A month ago'":
    "When toggled, cards will display the distance between today and the card's date. eg. 'In 3 days', 'A month ago'",
  'Hide card display dates': 'Hide card display dates',
  'Hide card counts in list titles': 'Hide card counts in list titles',
  'When toggled, card counts are hidden from the list title':
    'When toggled, card counts are hidden from the list title',
  'When toggled, formatted dates will not be displayed on the card. Relative dates will still be displayed if they are enabled.':
    'When toggled, formatted dates will not be displayed on the card. Relative dates will still be displayed if they are enabled.',
  'Hide dates in card titles': 'Hide dates in card titles',
  'When toggled, dates will be hidden card titles. This will prevent dates from being included in the title when creating new notes.':
    'When toggled, dates will be hidden card titles. This will prevent dates from being included in the title when creating new notes.',
  'Link dates to daily notes': 'Link dates to daily notes',
  'When toggled, dates will link to daily notes. Eg. [[2021-04-26]]':
    'When toggled, dates will link to daily notes. Eg. [[2021-04-26]]',
  'Add date and time to archived cards': 'Add date and time to archived cards',
  'When toggled, the current date and time will be added to the card title when it is archived. Eg. - [ ] 2021-05-14 10:00am My card title':
    'When toggled, the current date and time will be added to the card title when it is archived. Eg. - [ ] 2021-05-14 10:00am My card title',
  'Add archive date/time after card title':
    'Add archive date/time after card title',
  'When toggled, the archived date/time will be added after the card title, e.g.- [ ] My card title 2021-05-14 10:00am. By default, it is inserted before the title.':
    'When toggled, the archived date/time will be added after the card title, e.g.- [ ] My card title 2021-05-14 10:00am. By default, it is inserted before the title.',
  'Archive date/time separator': 'Archive date/time separator',
  'This will be used to separate the archived date/time from the title':
    'This will be used to separate the archived date/time from the title',
  'Archive date/time format': 'Archive date/time format',
  'Kanban Plugin': 'Kanban Plugin',
  'Hide tags in card titles': 'Hide tags in card titles',
  'When toggled, tags will be hidden card titles. This will prevent tags from being included in the title when creating new notes.':
    'When toggled, tags will be hidden card titles. This will prevent tags from being included in the title when creating new notes.',
  'Hide card display tags': 'Hide card display tags',
  'When toggled, tags will not be displayed below the card title.':
    'When toggled, tags will not be displayed below the card title.',
  'Tag action': 'Tag action',
  'Search Kanban Board': 'Search Kanban Board',
  'Search Obsidian Vault': 'Search Obsidian Vault',
  'This setting controls whether clicking the tags displayed below the card title opens the Obsidian search or the Kanban board search.':
    'This setting controls whether clicking the tags displayed below the card title opens the Obsidian search or the Kanban board search.',
  'Display tag colors': 'Display tag colors',
  'Set colors for the tags displayed below the card title.':
    'Set colors for the tags displayed below the card title.',
  'Linked Page Metadata': 'Linked Page Metadata',
  'Display metadata for the first note linked within a card. Specify which metadata keys to display below. An optional label can be provided, and labels can be hidden altogether.':
    'Display metadata for the first note linked within a card. Specify which metadata keys to display below. An optional label can be provided, and labels can be hidden altogether.',
  'Board Header Buttons': 'Board Header Buttons',
  'Calendar: first day of week': 'Calendar: first day of week',
  'Override which day is used as the start of the week':
    'Override which day is used as the start of the week',
  Sunday: 'Sunday',
  Monday: 'Monday',
  Tuesday: 'Tuesday',
  Wednesday: 'Wednesday',
  Thursday: 'Thursday',
  Friday: 'Friday',
  Saturday: 'Saturday',
  'Background color': 'Background color',
  Tag: 'Tag',
  'Text color': 'Text color',
  'Date is': 'Date is',
  Today: 'Today',
  'After now': 'After now',
  'Before now': 'Before now',
  'Between now and': 'Between now and',
  'Display date colors': 'Display date colors',
  'Set colors for the date displayed below the card based on the rules below':
    'Set colors for the date displayed below the card based on the rules below',
  'Add date color': 'Add date color',

  // MetadataSettings.tsx
  'Metadata key': 'Metadata key',
  'Display label': 'Display label',
  'Hide label': 'Hide label',
  'Drag to rearrange': 'Drag to rearrange',
  Delete: 'Delete',
  'Add key': 'Add key',
  'Field contains markdown': 'Field contains markdown',

  // TagColorSettings.tsx
  'Add tag color': 'Add tag color',

  // components/Item/Item.tsx
  'More options': 'More options',
  Cancel: 'Cancel',

  // components/Item/ItemContent.tsx
  today: 'today',
  yesterday: 'yesterday',
  tomorrow: 'tomorrow',
  'Change date': 'Change date',
  'Change time': 'Change time',

  // components/Item/ItemForm.tsx
  'Card title...': 'Card title...',
  'Add card': 'Add card',
  'Add a card': 'Add a card',

  // components/Item/ItemMenu.ts
  'Edit card': 'Edit card',
  'New note from card': 'New note from card',
  'Archive card': 'Archive card',
  'Delete card': 'Delete card',
  'Edit date': 'Edit date',
  'Add date': 'Add date',
  'Remove date': 'Remove date',
  'Edit time': 'Edit time',
  'Add time': 'Add time',
  'Remove time': 'Remove time',
  'Duplicate card': 'Duplicate card',
  'Split card': 'Split card',
  'Copy link to card': 'Copy link to card',
  'Insert card before': 'Insert card before',
  'Insert card after': 'Insert card after',
  'Add label': 'Add label',
  'Move to top': 'Move to top',
  'Move to bottom': 'Move to bottom',

  // components/Lane/LaneForm.tsx
  'Enter list title...': 'Enter list title...',
  'Mark cards in this list as complete': 'Mark cards in this list as complete',
  'Add list': 'Add list',
  'Add a list': 'Add a list',

  // components/Lane/LaneHeader.tsx
  'Move list': 'Move list',
  Close: 'Close',

  // components/Lane/LaneMenu.tsx
  'Are you sure you want to delete this list and all its cards?':
    'Are you sure you want to delete this list and all its cards?',
  'Yes, delete list': 'Yes, delete list',
  'Are you sure you want to archive this list and all its cards?':
    'Are you sure you want to archive this list and all its cards?',
  'Yes, archive list': 'Yes, archive list',
  'Are you sure you want to archive all cards in this list?':
    'Are you sure you want to archive all cards in this list?',
  'Yes, archive cards': 'Yes, archive cards',
  'Edit list': 'Edit list',
  'Archive cards': 'Archive cards',
  'Archive list': 'Archive list',
  'Delete list': 'Delete list',
  'Insert list before': 'Insert list before',
  'Insert list after': 'Insert list after',
  'Sort by card text': 'Sort by card text',
  'Sort by date': 'Sort by date',

  // components/helpers/renderMarkdown.ts
  'Unable to find': 'Unable to find',
  'Open in default app': 'Open in default app',

  // components/Editor/MarkdownEditor.tsx
  Submit: 'Submit',
};
