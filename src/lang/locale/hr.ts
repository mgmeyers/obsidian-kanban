// Croatian

const hr = {
  // main.ts
  'Open as kanban board': 'Otvori kao kanban ploču',  
  'Create new board': 'Stvori novu ploču',  
  'Archive completed cards in active board': 'Arhiviraj dovršene kartice na aktivnoj ploči',  
  'Error: current file is not a Kanban board': 'Pogreška: trenutna datoteka nije kanban ploča',  
  'Convert empty note to Kanban': 'Pretvori praznu bilješku u Kanban',  
  'Error: cannot create Kanban, the current note is not empty': 'Pogreška: nije moguće stvoriti Kanban, trenutna bilješka nije prazna',  
  'New kanban board': 'Nova kanban ploča',  
  'Untitled Kanban': 'Neimenovana Kanban ploča',  
  'Toggle between Kanban and markdown mode': 'Prebaci između Kanban i Markdown načina',  

  'View as board': 'Prikaz kao ploča',  
  'View as list': 'Prikaz kao popis',  
  'View as table': 'Prikaz kao tablica',  
  'Board view': 'Prikaz ploče'

  // KanbanView.tsx
  'Open as markdown': 'Otvori kao markdown',  
  'Open board settings': 'Otvori postavke ploče',  
  'Archive completed cards': 'Arhiviraj dovršene kartice',  
  'Something went wrong': 'Nešto je pošlo po zlu',  
  'You may wish to open as markdown and inspect or edit the file.': 'Možda želiš otvoriti kao markdown i pregledati ili urediti datoteku.',  
  'Are you sure you want to archive all completed cards on this board?': 'Jesi li siguran da želiš arhivirati sve dovršene kartice na ovoj ploči?',  

  // parser.ts
  Complete: 'Dovršeno',  
  Archive: 'Arhiviraj',  
  'Invalid Kanban file: problems parsing frontmatter': 'Nevažeća Kanban datoteka: problemi s prikazom zaglavlja',  
  "I don't know how to interpret this line:": "Ne znam kako protumačiti ovaj redak:",  
  Untitled: 'Neimenovano',  

  // settingHelpers.ts
  'Note: No template plugins are currently enabled.': 'Napomena: Nema trenutno omogućenih dodataka za predloške.',  
  default: 'zadano',  
  'Search...': 'Pretraži...'

  // Settings.ts
  'New line trigger': 'Okidač za novi redak',  
  'Select whether Enter or Shift+Enter creates a new line. The opposite of what you choose will create and complete editing of cards and lists.': 'Odaberi hoće li Enter ili Shift+Enter stvoriti novi redak. Suprotna opcija od odabrane će stvarati i dovršavati uređivanje kartica i popisa.',  
  'Shift + Enter': 'Shift + Enter',  
  Enter: 'Enter',  
  'Prepend / append new cards': 'Dodaj nove kartice na početak / kraj',  
  'This setting controls whether new cards are added to the beginning or end of the list.': 'Ova postavka određuje dodaju li se nove kartice na početak ili kraj popisa.',  
  Prepend: 'Dodaj na početak',  
  'Prepend (compact)': 'Dodaj na početak (kompaktno)',  
  Append: 'Dodaj na kraj',  
  'These settings will take precedence over the default Kanban board settings.': 'Ove postavke imat će prednost nad zadanim postavkama Kanban ploče.',  
  'Set the default Kanban board settings. Settings can be overridden on a board-by-board basis.': 'Postavi zadane postavke za Kanban ploču. Postavke se mogu zamijeniti za svaku ploču posebno.',  
  'Note template': 'Predložak bilješke',  
  'This template will be used when creating new notes from Kanban cards.': 'Ovaj predložak će se koristiti pri stvaranju novih bilješki iz Kanban kartica.',  
  'No template': 'Bez predloška',  
  'Note folder': 'Mapa za bilješke',  
  'Notes created from Kanban cards will be placed in this folder. If blank, they will be placed in the default location for this vault.': 'Bilješke stvorene iz Kanban kartica bit će smještene u ovu mapu. Ako je prazna, bit će smještene u zadano mjesto ove arhive.',  
  'Default folder': 'Zadana mapa',  
  'List width': 'Širina popisa',  
  'Expand lists to full width in list view': 'Raširi popise na punu širinu u prikazu popisa',  
  'Enter a number to set the list width in pixels.': 'Unesi broj za postavljanje širine popisa u pikselima.',  
  'Maximum number of archived cards': 'Maksimalan broj arhiviranih kartica',  
  "Archived cards can be viewed in markdown mode. This setting will begin removing old cards once the limit is reached. Setting this value to -1 will allow a board's archive to grow infinitely.": "Arhivirane kartice mogu se pregledavati u markdown načinu. Kada se dostigne ograničenje, ova postavka će početi uklanjati stare kartice. Postavljanje ove vrijednosti na -1 omogućit će neograničeno povećanje arhive ploče.",  
  'Display card checkbox': 'Prikaži kućicu za označavanje kartice',  
  'When toggled, a checkbox will be displayed with each card': 'Kad je omogućeno, svaka kartica će imati kućicu za označavanje',  
  'Reset to default': 'Vrati na zadano',  
  'Date & Time': 'Datum i vrijeme',  
  'Date trigger': 'Okidač za datum',  
  'When this is typed, it will trigger the date selector': 'Kada se ovo upiše, pokrenut će se birač datuma',  
  'Time trigger': 'Okidač za vrijeme',  
  'When this is typed, it will trigger the time selector': 'Kada se ovo upiše, pokrenut će se birač vremena',  
  'Date format': 'Format datuma',  
  'This format will be used when saving dates in markdown.': 'Ovaj format će se koristiti pri spremanju datuma u markdownu.',  
  'For more syntax, refer to': 'Za više sintakse, pogledaj',  
  'format reference': 'referencu formata',  
  'Your current syntax looks like this': 'Tvoja trenutna sintaksa izgleda ovako',  
  'Time format': 'Format vremena',  
  'Date display format': 'Format prikaza datuma',  
  'This format will be used when displaying dates in Kanban cards.': 'Ovaj format će se koristiti pri prikazu datuma u Kanban karticama.',  
  'Show relative date': 'Prikaži relativni datum',  
  "When toggled, cards will display the distance between today and the card's date. eg. 'In 3 days', 'A month ago'. Relative dates will not be shown for dates from the Tasks and Dataview plugins.": "Kada je omogućeno, kartice će prikazivati vremenski razmak između današnjeg dana i datuma na kartici, npr. 'Za 3 dana', 'Prije mjesec dana'. Relativni datumi neće se prikazivati za datume iz dodataka Tasks i Dataview."

  'Move dates to card footer': 'Premjesti datume u podnožje kartice',  
  "When toggled, dates will be displayed in the card's footer instead of the card's body.": "Kada je omogućeno, datumi će se prikazivati u podnožju kartice umjesto u tijelu kartice.",  
  'Move tags to card footer': 'Premjesti oznake u podnožje kartice',  
  "When toggled, tags will be displayed in the card's footer instead of the card's body.": "Kada je omogućeno, oznake će se prikazivati u podnožju kartice umjesto u tijelu kartice.",  
  'Move task data to card footer': 'Premjesti podatke zadatka u podnožje kartice',  
  "When toggled, task data (from the Tasks plugin) will be displayed in the card's footer instead of the card's body.": "Kada je omogućeno, podaci zadatka (iz dodatka Tasks) prikazivat će se u podnožju kartice umjesto u tijelu kartice.",  
  'Inline metadata position': 'Pozicija ugrađenih metapodataka',  
  'Controls where the inline metadata (from the Dataview plugin) will be displayed.': 'Upravlja time gdje će se prikazivati ugrađeni metapodaci (iz dodatka Dataview).',  
  'Card body': 'Tijelo kartice',  
  'Card footer': 'Podnožje kartice',  
  'Merge with linked page metadata': 'Spoji s metapodacima povezane stranice',  

  'Hide card counts in list titles': 'Sakrij broj kartica u naslovima popisa',  
  'When toggled, card counts are hidden from the list title': 'Kada je omogućeno, broj kartica se skriva iz naslova popisa',  
  'Link dates to daily notes': 'Poveži datume s dnevnim bilješkama',  
  'When toggled, dates will link to daily notes. Eg. [[2021-04-26]]': 'Kada je omogućeno, datumi će biti povezani s dnevnim bilješkama. Npr. [[2021-04-26]]',  
  'Add date and time to archived cards': 'Dodaj datum i vrijeme na arhivirane kartice',  
  'When toggled, the current date and time will be added to the card title when it is archived. Eg. - [ ] 2021-05-14 10:00am My card title': 'Kada je omogućeno, trenutni datum i vrijeme bit će dodani u naslov kartice prilikom arhiviranja. Npr. - [ ] 2021-05-14 10:00am Naslov moje kartice',  
  'Add archive date/time after card title': 'Dodaj datum/vrijeme arhive iza naslova kartice',  
  'When toggled, the archived date/time will be added after the card title, e.g.- [ ] My card title 2021-05-14 10:00am. By default, it is inserted before the title.': 'Kada je omogućeno, datum/vrijeme arhive bit će dodani iza naslova kartice, npr. - [ ] Naslov moje kartice 2021-05-14 10:00am. Zadano se umeće prije naslova.',  
  'Archive date/time separator': 'Razdjelnik datuma/vremena arhive',  
  'This will be used to separate the archived date/time from the title': 'Ovo će se koristiti za razdvajanje arhiviranog datuma/vremena od naslova',  
  'Archive date/time format': 'Format datuma/vremena arhive',  
  'Kanban Plugin': 'Kanban dodatak',  
  'Tag click action': 'Radnja pri kliku na oznaku',  
  'Search Kanban Board': 'Pretraži Kanban ploču',  
  'Search Obsidian Vault': 'Pretraži Obsidian arhivu',  
  'This setting controls whether clicking the tags displayed below the card title opens the Obsidian search or the Kanban board search.': 'Ova postavka određuje hoće li klik na oznake ispod naslova kartice otvoriti pretragu u Obsidianu ili u Kanban ploči.',  
  'Tag colors': 'Boje oznaka',  
  'Set colors for tags displayed in cards.': 'Postavi boje za oznake prikazane u karticama.',  
  'Linked Page Metadata': 'Metapodaci povezane stranice',  
  'Inline Metadata': 'Ugrađeni metapodaci',  
  'Display metadata for the first note linked within a card. Specify which metadata keys to display below. An optional label can be provided, and labels can be hidden altogether.': 'Prikaži metapodatke prve bilješke povezane unutar kartice. Navedite koje ključeve metapodataka prikazati u nastavku. Može se dodati opcionalna oznaka, a oznake se mogu i potpuno sakriti.',  
  'Board Header Buttons': 'Gumbi zaglavlja ploče',  
  'Calendar: first day of week': 'Kalendar: prvi dan u tjednu',  
  'Override which day is used as the start of the week': 'Nadjačaj koji dan se koristi kao početak tjedna',  
  Sunday: 'Nedjelja',  
  Monday: 'Ponedjeljak',  
  Tuesday: 'Utorak',  
  Wednesday: 'Srijeda',  
  Thursday: 'Četvrtak',  
  Friday: 'Petak',  
  Saturday: 'Subota',  
  'Background color': 'Boja pozadine',  
  Tag: 'Oznaka',  
  'Text color': 'Boja teksta',  
  'Date is': 'Datum',  
  Today: 'Danas',  
  'After now': 'Nakon sadašnjeg trenutka',  
  'Before now': 'Prije sadašnjeg trenutka',  
  'Between now and': 'Između sada i',  
  'Display date colors': 'Prikaži boje datuma',  
  'Set colors for dates displayed in cards based on the rules below.': 'Postavi boje za datume prikazane u karticama prema dolje navedenim pravilima.',  
  'Add date color': 'Dodaj boju datuma'

  // MetadataSettings.tsx
  'Metadata key': 'Ključ metapodatka',
  'Display label': 'Prikaz oznake',
  'Hide label': 'Sakrij oznaku',
  'Drag to rearrange': 'Povuci za premještanje',
  Delete: 'Izbriši',
  'Add key': 'Dodaj ključ',
  'Add tag': 'Dodaj oznaku',
  'Field contains markdown': 'Polje sadrži markdown',
  'Tag sort order': 'Redoslijed sortiranja oznaka',
  'Set an explicit sort order for the specified tags.': 'Postavi eksplicitan redoslijed sortiranja za navedene oznake.'

  // TagColorSettings.tsx
  'Add tag color': 'Dodaj boju oznake',

  // components/Table.tsx
  List: 'Popis',
  Card: 'Kartica',
  Date: 'Datum',
  Tags: 'Oznake',

  Priority: 'Prioritet',
  Start: 'Početak',
  Created: 'Stvoreno',
  Scheduled: 'Zakazano',
  Due: 'Rok',
  Cancelled: 'Otkazano',
  Recurrence: 'Ponavljanje',
  'Depends on': 'Ovisi o',
  ID: 'ID',

  // components/Item/Item.tsx
  'More options': 'Više mogućnosti',
  Cancel: 'Otkaži',
  Done: 'Gotovo',
  Save: 'Spremi',
  
  // components/Item/ItemContent.tsx
  today: 'danas',
  yesterday: 'jučer',
  tomorrow: 'sutra',
  'Change date': 'Promijeni datum',
  'Change time': 'Promijeni vrijeme',
  
  // components/Item/ItemForm.tsx
  'Card title...': 'Naziv kartice...',
  'Add card': 'Dodaj karticu',
  'Add a card': 'Dodaj karticu',

  // components/Item/ItemMenu.ts
  'Edit card': 'Uredi karticu',  
  'New note from card': 'Nova bilješka iz kartice',  
  'Archive card': 'Arhiviraj karticu',  
  'Delete card': 'Izbriši karticu',  
  'Edit date': 'Promijeni datum',  
  'Add date': 'Dodaj datum',  
  'Remove date': 'Ukloni datum',  
  'Edit time': 'Uredi vrijeme',  
  'Add time': 'Dodaj vrijeme',  
  'Remove time': 'Ukloni vrijeme',  
  'Duplicate card': 'Dupliciraj karticu',  
  'Split card': 'Podijeli karticu',  
  'Copy link to card': 'Kopiraj poveznicu na karticu',  
  'Insert card before': 'Umetni karticu prije',  
  'Insert card after': 'Umetni karticu poslije',  
  'Add label': 'Dodaj oznaku',  
  'Move to top': 'Premjesti na vrh',  
  'Move to bottom': 'Premjesti na dno',  
  'Move to list': 'Premjesti na popis',
  
  // components/Lane/LaneForm.tsx
  'Enter list title...': 'Unesi naslov liste...',
  'Mark cards in this list as complete': 'Označi kartice u ovoj listi kao gotove',
  'Add list': 'Dodaj listu',
  'Add a list': 'Dodaj listu',

  // components/Lane/LaneHeader.tsx
  'Move list': ''Premjesti listu',
  Close: 'Zatvori',
   	
  // components/Lane/LaneMenu.tsx
  'Are you sure you want to delete this list and all its cards?':  
	'Jeste li sigurni da želite izbrisati ovaj popis i sve njegove kartice?',
  'Yes, delete list': 'Da, izbriši popis',
  'Are you sure you want to archive this list and all its cards?':  
	'Jeste li sigurni da želite arhivirati ovaj popis i sve njegove kartice?',
  'Yes, archive list': 'Da, arhiviraj popis',
  'Are you sure you want to archive all cards in this list?':  
	'Jeste li sigurni da želite arhivirati sve kartice u ovom popisu?',
  'Yes, archive cards': 'Da, arhiviraj kartice',
  'Edit list': 'Uredi popis',
  'Archive cards': 'Arhiviraj kartice',
  'Archive list': 'Arhiviraj popis',
  'Delete list': 'Izbriši popis',
  'Insert list before': 'Umetni popis prije',
  'Insert list after': 'Umetni popis poslije',
  'Sort by card text': 'Sortiraj po tekstu kartice',
  'Sort by date': 'Sortiraj po datumu',
  'Sort by tags': 'Sortiraj po oznakama',
  'Sort by': 'Sortiraj po',
   
  // components/helpers/renderMarkdown.ts
  'Unable to find': 'Nije moguće pronaći',
  'Open in default app': 'Otvori u zadanoj aplikaciji',

  // components/Editor/MarkdownEditor.tsx
  Submit: 'Pošalji',
  };

export type Lang = typeof hr;
export default hr;
