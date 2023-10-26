// français

export default {
    // main.ts
    'Open as kanban board': 'Open as kanban board', // TODO
    'Create new board': 'Créer un nouveau tableau',
    'Archive completed cards in active board': // TODO
        'Archive completed cards in active board', // TODO
    'Error: current file is not a Kanban board': // TODO
        'Error: current file is not a Kanban board', // TODO
    'Convert empty note to Kanban': 'Convert empty note to Kanban', // TODO
    'Error: cannot create Kanban, the current note is not empty': // TODO
        'Error: cannot create Kanban, the current note is not empty', // TODO
    'New kanban board': 'New kanban board', // TODO
    'Untitled Kanban': 'Untitled Kanban', // TODO
    'Toggle between Kanban and markdown mode': // TODO
        'Toggle between Kanban and markdown mode', // TODO

    // KanbanView.tsx
    'Open as markdown': 'Ouvrir au format Markdown',
    'Open board settings': 'Ouvrir les paramètres du tableau',
    'Archive completed cards': 'Archiver les cartes complétées',
    'Something went wrong': 'Something went wrong', // TODO
    'You may wish to open as markdown and inspect or edit the file.': // TODO
        'You may wish to open as markdown and inspect or edit the file.', // TODO
    'Are you sure you want to archive all completed cards on this board?': // TODO
        'Are you sure you want to archive all completed cards on this board?', // TODO

    // parser.ts
    Complete: 'Complete', // TODO
    Archive: 'Archive', // TODO
    'Invalid Kanban file: problems parsing frontmatter': // TODO
        'Invalid Kanban file: problems parsing frontmatter', // TODO
    "I don't know how to interpret this line:": // TODO
        "I don't know how to interpret this line:", // TODO
    Untitled: 'Sans titre', // auto-created column

    // settingHelpers.ts
    'Note: No template plugins are currently enabled.': // TODO
        'Note: No template plugins are currently enabled.', // TODO
    default: 'default', // TODO
    'Search...': 'Rechercher...',

    // Settings.ts
    'New line trigger': 'Créer une nouvelle ligne',
    'Select whether Enter or Shift+Enter creates a new line. The opposite of what you choose will create and complete editing of cards and lists.':
        'Choisir entre la touche Entrée ou le combo Shift+Entrée pour créer une nouvelle ligne. Le choix non selectionné créera valider la création ou l\'édition de la carte ou la liste.',
    'Shift + Enter': 'Shift + Entrée',
    Enter: 'Entrée',
    'Prepend / append new cards': 'Prepend / append new cards', // TODO
    'This setting controls whether new cards are added to the beginning or end of the list.': // TODO
        'This setting controls whether new cards are added to the beginning or end of the list.', // TODO
    Prepend: 'Prepend', // TODO
    'Prepend (compact)': 'Prepend (compact)', // TODO
    Append: 'Append', // TODO
    'These settings will take precedence over the default Kanban board settings.':
        'Ces paramètres seront prédominants sur les paramètres de la page de paramètres globaux de l\'extension Kanban.', //! CHECK BEFORE PR
    'Set the default Kanban board settings. Settings can be overridden on a board-by-board basis.': // TODO
        'Set the default Kanban board settings. Settings can be overridden on a board-by-board basis.', // TODO
    'Note template': 'Modèle de note', // TODO
    'This template will be used when creating new notes from Kanban cards.': // TODO
        'This template will be used when creating new notes from Kanban cards.', // TODO
    'No template': 'Aucun modèle sélectionné',
    'Note folder': 'Note folder', // TODO
    'Notes created from Kanban cards will be placed in this folder. If blank, they will be placed in the default location for this vault.': // TODO
        'Notes created from Kanban cards will be placed in this folder. If blank, they will be placed in the default location for this vault.', // TODO
    'Default folder': 'Default folder', // TODO
    'List width': 'List width', // TODO
    'Enter a number to set the list width in pixels.': // TODO
        'Enter a number to set the list width in pixels.', // TODO
    'Maximum number of archived cards': 'Maximum number of archived cards', // TODO
    "Archived cards can be viewed in markdown mode. This setting will begin removing old cards once the limit is reached. Setting this value to -1 will allow a board's archive to grow infinitely.": // TODO
        "Archived cards can be viewed in markdown mode. This setting will begin removing old cards once the limit is reached. Setting this value to -1 will allow a board's archive to grow infinitely.", // TODO
    'Display card checkbox': 'Display card checkbox', // TODO
    'When toggled, a checkbox will be displayed with each card': // TODO
        'When toggled, a checkbox will be displayed with each card', // TODO
    'Reset to default': 'Reset to default', // TODO
    'Date & Time': 'Date & Time', // TODO
    'Date trigger': 'Date trigger', // TODO
    'When this is typed, it will trigger the date selector': // TODO
        'When this is typed, it will trigger the date selector', // TODO
    'Time trigger': 'Time trigger', // TODO
    'When this is typed, it will trigger the time selector': // TODO
        'When this is typed, it will trigger the time selector', // TODO
    'Date format': 'Date format', // TODO
    'This format will be used when saving dates in markdown.': // TODO
        'This format will be used when saving dates in markdown.', // TODO
    'For more syntax, refer to': 'For more syntax, refer to', // TODO
    'format reference': 'format reference', // TODO
    'Your current syntax looks like this': 'Your current syntax looks like this', // TODO
    'Time format': 'Time format', // TODO
    'Date display format': 'Date display format', // TODO
    'This format will be used when displaying dates in Kanban cards.': // TODO
        'This format will be used when displaying dates in Kanban cards.', // TODO
    'Show relative date': 'Show relative date', // TODO
    "When toggled, cards will display the distance between today and the card's date. eg. 'In 3 days', 'A month ago'": // TODO
        "When toggled, cards will display the distance between today and the card's date. eg. 'In 3 days', 'A month ago'", // TODO
    'Hide card display dates': 'Hide card display dates', // TODO
    'Hide card counts in list titles': 'Hide card counts in list titles', // TODO
    'When toggled, card counts are hidden from the list title': // TODO
        'When toggled, card counts are hidden from the list title', // TODO
    'When toggled, formatted dates will not be displayed on the card. Relative dates will still be displayed if they are enabled.': // TODO
        'When toggled, formatted dates will not be displayed on the card. Relative dates will still be displayed if they are enabled.', // TODO
    'Hide dates in card titles': 'Hide dates in card titles', // TODO
    'When toggled, dates will be hidden card titles. This will prevent dates from being included in the title when creating new notes.': // TODO
        'When toggled, dates will be hidden card titles. This will prevent dates from being included in the title when creating new notes.', // TODO
    'Link dates to daily notes': 'Link dates to daily notes', // TODO
    'When toggled, dates will link to daily notes. Eg. [[2021-04-26]]': // TODO
        'When toggled, dates will link to daily notes. Eg. [[2021-04-26]]', // TODO
    'Add date and time to archived cards': 'Add date and time to archived cards', // TODO
    'When toggled, the current date and time will be added to the card title when it is archived. Eg. - [ ] 2021-05-14 10:00am My card title': // TODO
        'When toggled, the current date and time will be added to the card title when it is archived. Eg. - [ ] 2021-05-14 10:00am My card title', // TODO
    'Add archive date/time after card title': // TODO
        'Add archive date/time after card title', // TODO
    'When toggled, the archived date/time will be added after the card title, e.g.- [ ] My card title 2021-05-14 10:00am. By default, it is inserted before the title.': // TODO
        'When toggled, the archived date/time will be added after the card title, e.g.- [ ] My card title 2021-05-14 10:00am. By default, it is inserted before the title.', // TODO
    'Archive date/time separator': 'Archive date/time separator', // TODO
    'This will be used to separate the archived date/time from the title': // TODO
        'This will be used to separate the archived date/time from the title', // TODO
    'Archive date/time format': 'Archive date/time format', // TODO
    'Kanban Plugin': 'Kanban Plugin', // TODO
    'Hide tags in card titles': 'Hide tags in card titles', // TODO
    'When toggled, tags will be hidden card titles. This will prevent tags from being included in the title when creating new notes.': // TODO
        'When toggled, tags will be hidden card titles. This will prevent tags from being included in the title when creating new notes.', // TODO
    'Hide card display tags': 'Hide card display tags', // TODO
    'When toggled, tags will not be displayed below the card title.': // TODO
        'When toggled, tags will not be displayed below the card title.', // TODO
    'Display tag colors': 'Display tag colors', // TODO
    'Set colors for the tags displayed below the card title.': // TODO
        'Set colors for the tags displayed below the card title.', // TODO
    'Linked Page Metadata': 'Linked Page Metadata', // TODO
    'Display metadata for the first note linked within a card. Specify which metadata keys to display below. An optional label can be provided, and labels can be hidden altogether.': // TODO
        'Display metadata for the first note linked within a card. Specify which metadata keys to display below. An optional label can be provided, and labels can be hidden altogether.', // TODO
    'Board Header Buttons': 'Board Header Buttons', // TODO
    'Calendar: first day of week': 'Calendar: first day of week', // TODO
    'Override which day is used as the start of the week': // TODO
        'Override which day is used as the start of the week', // TODO
    Sunday: 'Dimanche',
    Monday: 'Lundi',
    Tuesday: 'Mardi',
    Wednesday: 'Mercredi',
    Thursday: 'Jeudi',
    Friday: 'Vendredi',
    Saturday: 'Samedi',
    'Background color': 'Background color', // TODO
    Tag: 'Tag', // TODO
    'Text color': 'Text color', // TODO
    'Date is': 'Date is', // TODO
    Today: 'Aujourd\'hui',
    'After now': 'After now', // TODO
    'Before now': 'Before now', // TODO
    'Between now and': 'Between now and', // TODO
    'Display date colors': 'Display date colors', // TODO
    'Set colors for the date displayed below the card based on the rules below': // TODO
        'Set colors for the date displayed below the card based on the rules below', // TODO
    'Add date color': 'Add date color', // TODO

    // MetadataSettings.tsx
    'Metadata key': 'Metadata key', // TODO
    'Display label': 'Display label', // TODO
    'Hide label': 'Hide label', // TODO
    'Drag to rearrange': 'Drag to rearrange', // TODO
    Delete: 'Supprimer',
    'Add key': 'Add key', // TODO
    'Field contains markdown': 'Field contains markdown', // TODO

    // TagColorSettings.tsx
    'Add tag color': 'Add tag color', // TODO

    // components/Item/Item.tsx
    'More options': 'More options', // TODO
    Cancel: 'Cancel', // TODO

    // components/Item/ItemContent.tsx
    today: 'aujourd\'hui', //! CHECK BEFORE PR
    yesterday: 'hier',
    tomorrow: 'demain',
    'Change date': 'Change date', // TODO
    'Change time': 'Change time', // TODO

    // components/Item/ItemForm.tsx
    'Card title...': 'Titre de la carte...', // TODO
    'Add card': 'Add card', // TODO
    'Add a card': 'Ajouter une carte',

    // components/Item/ItemMenu.ts
    'Edit card': 'Éditer la carte',
    'New note from card': 'Nouvelle note à partir de la carte',
    'Archive card': 'Archiver la carte',
    'Delete card': 'Supprimer la carte',
    'Edit date': 'Edit date', // TODO
    'Add date': 'Add date', // TODO
    'Remove date': 'Remove date', // TODO
    'Edit time': 'Edit time', // TODO
    'Add time': 'Add time', // TODO
    'Remove time': 'Remove time', // TODO
    'Duplicate card': 'Dupliquer la carte',
    'Split card': 'Split card', // TODO
    'Copy link to card': 'Copier le lien vers carte',
    'Insert card before': 'Insérer une carte au-dessus',
    'Insert card after': 'Insérer une carte en dessous',
    'Add label': 'Add label', // TODO
    'Move to top': 'Mettre en premier',
    'Move to bottom': 'Mettre en dernier',

    // components/Lane/LaneForm.tsx
    'Enter list title...': 'Entrer le titre de la liste...',
    'Mark cards in this list as complete': 'Marquer les cartes de cette liste comme complétées',
    'Add list': 'Ajouter la liste',
    'Add a list': 'Ajouter une liste',

    // components/Lane/LaneHeader.tsx
    'Move list': 'Move list', // TODO
    Close: 'Close', // TODO

    // components/Lane/LaneMenu.tsx
    'Are you sure you want to delete this list and all its cards?': // TODO
        'Are you sure you want to delete this list and all its cards?', // TODO
    'Yes, delete list': 'Yes, delete list', // TODO
    'Are you sure you want to archive this list and all its cards?': // TODO
        'Are you sure you want to archive this list and all its cards?', // TODO
    'Yes, archive list': 'Yes, archive list', // TODO
    'Are you sure you want to archive all cards in this list?': // TODO
        'Are you sure you want to archive all cards in this list?', // TODO
    'Yes, archive cards': 'Yes, archive cards', // TODO
    'Edit list': 'Edit list', // TODO
    'Archive cards': 'Archive cards', // TODO
    'Archive list': 'Archive list', // TODO
    'Delete list': 'Delete list', // TODO
    'Insert list before': 'Insert list before', // TODO
    'Insert list after': 'Insert list after', // TODO
    'Sort by card text': 'Sort by card text', // TODO
    'Sort by date': 'Sort by date', // TODO

    // components/helpers/renderMarkdown.ts
    'Unable to find': 'Unable to find', // TODO
    'Open in default app': 'Open in default app', // TODO

    // components/Editor/MarkdownEditor.tsx
    Submit: 'Submit', // TODO
};