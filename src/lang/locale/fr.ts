// français

export default {
    // main.ts
    'Open as kanban board': 'Ouvrir en tant que tableau kanban',
    'Create new board': 'Créer un nouveau tableau',
    'Archive completed cards in active board':
        'Archiver les cartes dans le tableau actif',
    'Error: current file is not a Kanban board':
        'Erreur: Le fichier actif n\'est pas un tableau kanban',
    'Convert empty note to Kanban': 'Convertir la note vide en Kanban',
    'Error: cannot create Kanban, the current note is not empty':
        'Erreur: impossible de créer le Kanban, la note actuelle n\'est pas vide',
    'New kanban board': 'Nouveau tableau kanban',
    'Untitled Kanban': 'Kanban sans titre',
    'Toggle between Kanban and markdown mode':
        'Basculer entre tableau Kanban & Markdown',

    // KanbanView.tsx
    'Open as markdown': 'Ouvrir au format Markdown',
    'Open board settings': 'Ouvrir les paramètres du tableau',
    'Archive completed cards': 'Archiver les cartes complétées',
    'Something went wrong': 'Une erreur s\'est porduite',
    'You may wish to open as markdown and inspect or edit the file.':
        'Vous pouvez ouvrir le fichier en tant que markdown pour l\'inspecter ou l\'éditer.',
    'Are you sure you want to archive all completed cards on this board?':
        'Êtes-vous sûr de vouloir archiver toutes les cartes terminées sur ce tableau ?',

    // parser.ts
    Complete: 'Complete', // TODO
    Archive: 'Archive', // TODO
    'Invalid Kanban file: problems parsing frontmatter':
        'Invalid Kanban file: problems parsing frontmatter', // TODO
    "I don't know how to interpret this line:":
        "Je ne sais pas comment interpréter cette ligne:",
    Untitled: 'Sans titre', // auto-created column

    // settingHelpers.ts
    'Note: No template plugins are currently enabled.':
        'Note : Aucun plugin de modèle de n\'est actuellement activé.',
    default: 'par défaut',
    'Search...': 'Rechercher...',

    // Settings.ts
    'New line trigger': 'Créer une nouvelle ligne',
    'Select whether Enter or Shift+Enter creates a new line. The opposite of what you choose will create and complete editing of cards and lists.':
        'Choisir entre la touche Entrée ou le combo Shift+Entrée pour créer une nouvelle ligne. Le choix non selectionné créera valider la création ou l\'édition de la carte ou la liste.',
    'Shift + Enter': 'Shift + Entrée',
    Enter: 'Entrée',
    'Prepend / append new cards': 'Prepend / append new cards', // TODO
    'This setting controls whether new cards are added to the beginning or end of the list.':
        'This setting controls whether new cards are added to the beginning or end of the list.', // TODO
    Prepend: 'Prepend', // TODO
    'Prepend (compact)': 'Prepend (compact)', // TODO
    Append: 'Append', // TODO
    'These settings will take precedence over the default Kanban board settings.':
        'Ces paramètres seront prédominants sur les paramètres de la page de paramètres globaux de l\'extension Kanban.',
    'Set the default Kanban board settings. Settings can be overridden on a board-by-board basis.':
        'Définir les paramètres par défaut du tableau Kanban. Les paramètres peuvent être modifiés pour chaque tableau.',
    'Note template': 'Modèle de note',
    'This template will be used when creating new notes from Kanban cards.':
        'Ce modèle sera utilisé lors de la création de nouvelles notes à partir de cartes Kanban.',
    'No template': 'Aucun modèle sélectionné',
    'Note folder': 'Dossier de notes',
    'Notes created from Kanban cards will be placed in this folder. If blank, they will be placed in the default location for this vault.':
        'Les notes créées à partir des cartes Kanban seront placées dans ce dossier. Si ce paramètre est vide, elles seront placées dans l\'emplacement par défaut de ce coffre-fort.',
    'Default folder': 'Dossier par défaut',
    'List width': 'Largeur des listes',
    'Enter a number to set the list width in pixels.':
        'Entrez un nombre pour fixer la largeur des listes en pixels.',
    'Maximum number of archived cards': 'Nombre maximum de cartes archivées',
    "Archived cards can be viewed in markdown mode. This setting will begin removing old cards once the limit is reached. Setting this value to -1 will allow a board's archive to grow infinitely.":
        "Les cartes archivées peuvent être visionnées en mode markdown. Ce paramètre supprimera les cartes les plus anciennes lorsque la limite sera atteinte. Définir ce paramètre à -1 permet d'avoir un nombre infini de cartes en archive.",
    'Display card checkbox': 'Afficher les case à coche des cartes',
    'When toggled, a checkbox will be displayed with each card':
        'Si activé, une case à cocher s\'affichera pour chaque carte.',
    'Reset to default': 'Réinitialiser les paramètres par défaut',
    'Date & Time': 'Date & Heure',
    'Date trigger': 'Date trigger', // TODO
    'When this is typed, it will trigger the date selector':
        'Lorsqu\'il est tapé, il déclenchera le sélecteur de date',
    'Time trigger': 'Time trigger', // TODO
    'When this is typed, it will trigger the time selector':
        'Lorsqu\'il est tapé, il déclenchera le sélecteur d\'heure',
    'Date format': 'Format des dates',
    'This format will be used when saving dates in markdown.':
        'Ce format sera utilisé lors de la sauvegarde de dates en markdown.',
    'For more syntax, refer to': 'Pour plus de syntaxes, référez-vous à',
    'format reference': 'cette documentation',
    'Your current syntax looks like this': 'La syntaxe actuelle s\'affiche de cette façon',
    'Time format': 'Format de l\'heure',
    'Date display format': 'Format d\'affichage de la date',
    'This format will be used when displaying dates in Kanban cards.':
        'Ce format sera utilisé pour l\'affichage des dates dans les cartes Kanban.',
    'Show relative date': 'Afficher la date relative',
    "When toggled, cards will display the distance between today and the card's date. eg. 'In 3 days', 'A month ago'":
        "Lorsque cette option est activée, les cartes affichent le temps entre aujourd'hui et la date de la carte de cette façon : 'Dans 3 jours', 'Il y a un mois'.",
    'Hide card display dates': 'Hide card display dates', // TODO
    'Hide card counts in list titles': 'Cacher le nombre de cartes dans les titres des listes',
    'When toggled, card counts are hidden from the list title':
        'Lorsque cette option est activée, le nombre de cartes est masqué dans le titre de la liste.',
    'When toggled, formatted dates will not be displayed on the card. Relative dates will still be displayed if they are enabled.':
        'Lorsque cette option est activée, les dates formatées ne sont pas affichées sur la carte. Les dates relatives seront toujours affichées si elles sont activées.',
    'Hide dates in card titles': 'Cacher les dates dans les titres de cartes',
    'When toggled, dates will be hidden card titles. This will prevent dates from being included in the title when creating new notes.':
        'Lorsque cette option est activée, les dates sont masquées dans les titres des cartes. Cela permet d\'éviter que les dates soient incluses dans le titre lors de la création de nouvelles notes.',
    'Link dates to daily notes': 'Lier les dates aux notes quotidiennes',
    'When toggled, dates will link to daily notes. Eg. [[2021-04-26]]':
        'Lorsque cette option est activée, les dates sont liées aux notes quotidiennes. Ex. [[2021-04-26]]',
    'Add date and time to archived cards': 'Ajouter la date et l\'heure aux cartes archivées',
    'When toggled, the current date and time will be added to the card title when it is archived. Eg. - [ ] 2021-05-14 10:00am My card title':
        'Lorsque cette option est activée, la date et l\'heure actuelles sont ajoutées au titre de la carte lorsqu\'elle est archivée. Ex. - [ ] 2021-05-14 10:00am Le titre de ma carte',
    'Add archive date/time after card title':
        'Ajouter la date et l\'heure d\'archivage après le titre de la carte',
    'When toggled, the archived date/time will be added after the card title, e.g.- [ ] My card title 2021-05-14 10:00am. By default, it is inserted before the title.':
        'Lorsque cette option est activée, la date et l\'heure d\'archivage sont ajoutées après le titre de la carte, par exemple [ ] Mon titre de carte 2021-05-14 10:00am. Par défaut, elle est insérée avant le titre.',
    'Archive date/time separator': 'Séparateur date/heure de l\'archive',
    'This will be used to separate the archived date/time from the title':
        'Il sera utilisé pour séparer la date et l\'heure de l\'archivage du titre.',
    'Archive date/time format': 'Format de la date et de l\'heure de l\'archive',
    'Kanban Plugin': 'Plugin Kanban',
    'Hide tags in card titles': 'Masquer les étiquettes dans les titres des cartes',
    'When toggled, tags will be hidden card titles. This will prevent tags from being included in the title when creating new notes.':
        'Lorsque cette option est activée, les étiquettes sont masquées dans les titres des cartes. Cela empêchera les étiquettes d\'être incluses dans le titre lors de la création de nouvelles notes.',
    'Hide card display tags': 'Masquer les étiquettes de présentation des cartes',
    'When toggled, tags will not be displayed below the card title.':
        'Lorsque cette option est activée, les étiquettes ne sont pas affichés sous le titre de la carte.',
    'Display tag colors': 'Afficher les couleurs des étiquettes',
    'Set colors for the tags displayed below the card title.':
        'Définir les couleurs des étiquettes affichées sous le titre de la carte.',
    'Linked Page Metadata': 'Linked Page Metadata', // TODO
    'Display metadata for the first note linked within a card. Specify which metadata keys to display below. An optional label can be provided, and labels can be hidden altogether.':
        'Display metadata for the first note linked within a card. Specify which metadata keys to display below. An optional label can be provided, and labels can be hidden altogether.', // TODO
    'Board Header Buttons': 'Board Header Buttons', // TODO
    'Calendar: first day of week': 'Calendrier : premier jour de la semaine',
    'Override which day is used as the start of the week':
        'Remplacer le jour utilisé pour le début de la semaine',
    Sunday: 'Dimanche',
    Monday: 'Lundi',
    Tuesday: 'Mardi',
    Wednesday: 'Mercredi',
    Thursday: 'Jeudi',
    Friday: 'Vendredi',
    Saturday: 'Samedi',
    'Background color': 'Couleur d\'arrière-plan',
    Tag: 'Étiquette',
    'Text color': 'Couleur du texte',
    'Date is': 'La date est',
    Today: 'Aujourd\'hui',
    'After now': 'After now', // TODO
    'Before now': 'Before now', // TODO
    'Between now and': 'D\'ici à',
    'Display date colors': 'Afficher les couleurs de la date',
    'Set colors for the date displayed below the card based on the rules below':
        'Définir les couleurs de la date affichée sous la carte en fonction des règles suivantes',
    'Add date color': 'Ajouter une couleur à la date',

    // MetadataSettings.tsx
    'Metadata key': 'Clé des métadonnées',
    'Display label': 'Afficher l\'étiquette',
    'Hide label': 'Cacher l\'étiquette',
    'Drag to rearrange': 'Faire glisser pour réorganiser',
    Delete: 'Supprimer',
    'Add key': 'Ajouter une clé',
    'Field contains markdown': 'Le champ contient du markdown',

    // TagColorSettings.tsx
    'Add tag color': 'Ajouter une couleur à l\'étiquette',

    // components/Item/Item.tsx
    'More options': 'Plus d\'options',
    Cancel: 'Annuler',

    // components/Item/ItemContent.tsx
    today: 'aujourd\'hui',
    yesterday: 'hier',
    tomorrow: 'demain',
    'Change date': 'Modifier la date',
    'Change time': 'Modifier l\'heure',

    // components/Item/ItemForm.tsx
    'Card title...': 'Titre de la carte...',
    'Add card': 'Ajouter la carte',
    'Add a card': 'Ajouter une carte',

    // components/Item/ItemMenu.ts
    'Edit card': 'Éditer la carte',
    'New note from card': 'Nouvelle note à partir de la carte',
    'Archive card': 'Archiver la carte',
    'Delete card': 'Supprimer la carte',
    'Edit date': 'Modifier la date',
    'Add date': 'Ajouter une date',
    'Remove date': 'Suprimer la date',
    'Edit time': 'Modifier l\'heure',
    'Add time': 'Ajouter une heure',
    'Remove time': 'Supprimer l\'heure',
    'Duplicate card': 'Dupliquer la carte',
    'Split card': 'Diviser la carte',
    'Copy link to card': 'Copier le lien vers carte',
    'Insert card before': 'Insérer une carte au-dessus',
    'Insert card after': 'Insérer une carte en dessous',
    'Add label': 'Ajouter une étiquette',
    'Move to top': 'Mettre en premier',
    'Move to bottom': 'Mettre en dernier',

    // components/Lane/LaneForm.tsx
    'Enter list title...': 'Entrer le titre de la liste...',
    'Mark cards in this list as complete': 'Marquer les cartes de cette liste comme complétées',
    'Add list': 'Ajouter la liste',
    'Add a list': 'Ajouter une liste',

    // components/Lane/LaneHeader.tsx
    'Move list': 'Déplacer la liste',
    Close: 'Fermer',

    // components/Lane/LaneMenu.tsx
    'Are you sure you want to delete this list and all its cards?':
        'Êtes-vous sûr de vouloir supprimer cette liste et toutes ses cartes ?',
    'Yes, delete list': 'Oui, supprimer cette liste',
    'Are you sure you want to archive this list and all its cards?':
        'Êtes-vous sûr de vouloir archiver cette liste et toutes ses cartes ?',
    'Yes, archive list': 'Oui, archiver la liste',
    'Are you sure you want to archive all cards in this list?':
        'Êtes-vous sûr de vouloir archiver toutes les cartes de cette liste ?',
    'Yes, archive cards': 'Oui, archiver les cartes',
    'Edit list': 'Éditer la liste',
    'Archive cards': 'Archiver les cartes',
    'Archive list': 'Archiver la liste',
    'Delete list': 'Supprimer la liste',
    'Insert list before': 'Insérer la liste avant',
    'Insert list after': 'Insérer une liste après',
    'Sort by card text': 'Trier les cartes par texte',
    'Sort by date': 'Trier par date',

    // components/helpers/renderMarkdown.ts
    'Unable to find': 'Impossible de trouver',
    'Open in default app': 'Ouvrir dans l\'application par défaut',

    // components/Editor/MarkdownEditor.tsx
    Submit: 'Soumettre',
};