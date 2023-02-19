// Italiano

export default {
  // main.ts
  'Open as kanban board': 'Apri come bacheca Kanban',
  'Create new board': 'Crea nuova bacheca',
  'Archive completed cards in active board':
    'Archivia schede completate nella bacheca attiva',
  'Error: current file is not a Kanban board':
    'Errore: il file corrente non è una bacheca Kanban',
  'Convert empty note to Kanban': 'Converti nota vuota in Kanban',
  'Error: cannot create Kanban, the current note is not empty':
    'Errore: Impossibile creare Kanban, la nota corrente non è vuota',
  'New kanban board': 'Nuova bacheca Kanban',
  'Untitled Kanban': 'Kanban senza titolo',

  // KanbanView.tsx
  'Open as markdown': 'Apri come markdown',
  'Open board settings': 'Apri impostazioni bacheca',
  'Archive completed cards': 'Archivia schede completate',

  // parser.ts
  Complete: 'Completato',
  Archive: 'Archivio',

  // settingHelpers.ts
  'Note: No template plugins are currently enabled.':
    'Nota: Nessun plugin dei modelli attualmente abilitato.',
  default: 'predefinito',
  'Search...': 'Ricerca...',

  // Settings.ts
  'These settings will take precedence over the default Kanban board settings.':
    'Queste impostazioni avranno la precedenza sulle impostazioni predefinite della bacheca Kanban.',
  'Set the default Kanban board settings. Settings can be overridden on a board-by-board basis.':
    'Impostazioni predefinite della bacheca Kanban. Le impostazioni possono essere sovrascritte per ogni bacheca.',
  'Note template': 'Nota modello',
  'This template will be used when creating new notes from Kanban cards.':
    'Questo modello verrà utilizzato durante la creazione di nuove note dalle schede Kanban.',
  'No template': 'Nessun modello',
  'Note folder': 'Cartella delle note',
  'Notes created from Kanban cards will be placed in this folder. If blank, they will be placed in the default location for this vault.':
    'Le note create dalle schede Kanban verranno inserite in questa cartella. Se vuota, verranno inserite nella posizione predefinita del vault.',
  'Default folder': 'Cartella predefinita',
  'Lane width': 'Larghezza colonna',
  'Enter a number to set the lane width in pixels.':
    'Inserire un numero per impostare la larghezza della colonna in pixel.',
  'Maximum number of archived cards': 'Numero massimo di schede archiviate',
  "Archived cards can be viewed in markdown mode. This setting will begin removing old cards once the limit is reached. Setting this value to -1 will allow a board's archive to grow infinitely.":
    'Le schede archiviate possono essere visualizzate in modalità Markdown. Le vecchie schede verranno rimosse una volta raggiunto il limite. Impostando il valore -1 il numero di schede archiviate sarà illimitato.',
  'Display card checkbox': 'Mostra casella di controllo',
  'When toggled, a checkbox will be displayed with each card':
    'Se attiva, verrà visualizzata una casella di controllo per ogni scheda',
  'Reset to default': 'Ripristina predefiniti',
  'Date & Time': 'Data e ora',
  'Date trigger': 'Selettore data',
  'When this is typed, it will trigger the date selector':
    'Digitando questo, verrà attivato il selettore della data',
  'Time trigger': 'Selettore ora',
  'When this is typed, it will trigger the time selector':
    "Digitando questo, verrà attivato il selettore dell'ora",
  'Date format': 'Formato data',
  'This format will be used when saving dates in markdown.':
    'Formato utilizzato per il salvataggio delle date in Markdown.',
  'For more syntax, refer to': 'Per maggiori informazioni, vedere',
  'format reference': 'formato di riferimento',
  'Your current syntax looks like this': 'Formato corrente',
  'Time format': 'Formato ora',
  'Date display format': 'Formato visualizzazione data',
  'This format will be used when displaying dates in Kanban cards.':
    'Formato utilizzato per visualizzare le date nelle schede Kanban.',
  'Show relative date': 'Mostra data relativa',
  "When toggled, cards will display the distance between today and the card's date. eg. 'In 3 days', 'A month ago'":
    "Se attiva, le schede indicheranno la distanza tra la data odierna e la data della scheda. eg. 'Tra 3 giorni', 'Un mese fa'",
  'Hide card display dates': 'Hide card display dates',
  'When toggled, formatted dates will not be displayed on the card. Relative dates will still be displayed if they are enabled.':
    'Se attiva, la data non verrà mostrata sulla scheda. Le date relative verranno comunque mostrate se sono state abilitate.',
  'Hide dates in card titles': 'Nascondi date nei titoli delle schede',
  'When toggled, dates will be hidden card titles. This will prevent dates from being included in the title when creating new notes.':
    'Se attiva, la data non verrà mostrata nei titoli delle schede. Questo impedisce alle date di essere incluse quando vengono create nuove note.',
  'Link dates to daily notes': 'Collega date alle Note del giorno',
  'When toggled, dates will link to daily notes. Eg. [[2021-04-26]]':
    'Se attiva, le date verranno collegate alle Note del giorno. Eg. [[2021-04-26]]',
  'Add date and time to archived cards':
    'Aggiungi data e ora alle schede archiviate',
  'When toggled, the current date and time will be added to the card title when it is archived. Eg. - [ ] 2021-05-14 10:00am My card title':
    "Se attiva, la data e l'ora corrente verranno aggiunte all'inizio della scheda quando viene archiviata. Eg. - [ ] 2021-05-14 10:00am Mia scheda",
  'Archive date/time separator': "Separatore data/ora dell'archivio",
  'This will be used to separate the archived date/time from the title':
    "Verrà usato per separare data e ora dell'archiviazione dal titolo",
  'Archive date/time format': "Formato data/ora dell'archivio",
  'Kanban Plugin': 'Plugin Kanban',

  // components/Item/Item.tsx
  'More options': 'Altre opzioni',
  Cancel: 'Annulla',

  // components/Item/ItemContent.tsx
  today: 'oggi',
  yesterday: 'ieri',
  tomorrow: 'domani',
  'Change date': 'Modifica data',
  'Change time': 'Modifica ora',

  // components/Item/ItemForm.tsx
  'Card title...': 'Titolo elemento...',
  'Add card': 'Aggiungi elemento',
  'Add a card': "Aggiungi un'altra scheda",

  // components/Item/ItemMenu.ts
  'Edit card': 'Modifica scheda',
  'New note from card': 'Nuova nota da scheda',
  'Archive card': 'Archivia scheda',
  'Delete card': 'Elimina scheda',
  'Edit date': 'Modifica data',
  'Add date': 'Aggiungi data',
  'Remove date': 'Rimuovi data',
  'Edit time': 'Modifica ora',
  'Add time': 'Aggiungi ora',
  'Remove time': 'Rimuovi ora',

  // components/Lane/LaneForm.tsx
  'Enter list title...': 'Inserisci titolo lista...',
  'Mark cards in this list as complete':
    'Segna elementi della lista come completati',
  'Add list': 'Aggiungi lista',
  'Add a list': "Aggiungi un'altra lista",

  // components/Lane/LaneHeader.tsx
  'Move list': 'Sposta lista',
  Close: 'Chiudi',

  // components/Lane/LaneMenu.tsx
  'Are you sure you want to delete this list and all its cards?':
    'Cancellare questa lista e tutte le sue schede?',
  'Yes, delete list': 'Cancella lista',
  'Are you sure you want to archive this list and all its cards?':
    'Archiviare questa lista e tutte le sue schede?',
  'Yes, archive list': 'Archivia lista',
  'Are you sure you want to archive all cards in this list?':
    'Archiviare tutte le schede in questa lista?',
  'Yes, archive cards': 'Archivia schede',
  'Edit list': 'Modifica lista',
  'Archive cards': 'Archivia schede',
  'Archive list': 'Archivia lista',
  'Delete list': 'Cancella lista',
};
