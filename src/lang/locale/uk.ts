// Українська
import { Lang } from './en';

const lang: Partial<Lang> = {
  // main.ts
  'Open as kanban board': 'Відкрити як дошку Kanban',
  'Create new board': 'Створити нову дошку',
  'Archive completed cards in active board': 'Архівувати завершені картки на активній дошці',
  'Error: current file is not a Kanban board': 'Помилка: поточний файл не є дошкою Kanban',
  'Convert empty note to Kanban': 'Перетворити порожню нотатку на Kanban',
  'Error: cannot create Kanban, the current note is not empty':
    'Помилка: неможливо створити Kanban, поточна нотатка не порожня',
  'New kanban board': 'Нова дошка Kanban',
  'Untitled Kanban': 'Без назви Kanban',
  'Toggle between Kanban and markdown mode': 'Перемкнути між режимами Kanban і Markdown',

  'View as board': 'Переглянути як дошку',
  'View as list': 'Переглянути як список',
  'View as table': 'Переглянути як таблицю',
  'Board view': 'Вигляд дошки',

  // KanbanView.tsx
  'Open as markdown': 'Відкрити як Markdown',
  'Open board settings': 'Відкрити налаштування дошки',
  'Archive completed cards': 'Архівувати завершені картки',
  'Something went wrong': 'Щось пішло не так',
  'You may wish to open as markdown and inspect or edit the file.':
    'Ви можете відкрити як Markdown, щоб переглянути або відредагувати файл.',
  'Are you sure you want to archive all completed cards on this board?':
    'Ви впевнені, що хочете архівувати всі завершені картки на цій дошці?',

  // parser.ts
  Complete: 'Завершено',
  Archive: 'Архів',
  'Invalid Kanban file: problems parsing frontmatter':
    'Недійсний файл Kanban: проблеми під час розбору frontmatter',
  "I don't know how to interpret this line:": 'Не вдається інтерпретувати цей рядок:',
  Untitled: 'Без назви',

  // settingHelpers.ts
  'Note: No template plugins are currently enabled.':
    'Примітка: наразі не увімкнено жодного плагіна шаблонів.',
  default: 'за замовчуванням',
  'Search...': 'Пошук...',

  // Settings.ts
  'New line trigger': 'Тригер нового рядка',
  'Select whether Enter or Shift+Enter creates a new line. The opposite of what you choose will create and complete editing of cards and lists.':
    'Оберіть, чи Enter або Shift+Enter створює новий рядок. Протилежна дія зберігатиме й завершуватиме редагування карток та списків.',
  'Shift + Enter': 'Shift + Enter',
  Enter: 'Enter',
  'Prepend / append new cards': 'Додавати нові картки на початок / кінець',
  'This setting controls whether new cards are added to the beginning or end of the list.':
    'Визначає, чи додаватимуться нові картки на початок або в кінець списку.',
  Prepend: 'На початок',
  'Prepend (compact)': 'На початок (компактно)',
  Append: 'В кінець',
  'These settings will take precedence over the default Kanban board settings.':
    'Ці налаштування матимуть вищий пріоритет над типовими параметрами дошки Kanban.',
  'Set the default Kanban board settings. Settings can be overridden on a board-by-board basis.':
    'Встановіть типові налаштування дошки. Їх можна перевизначити індивідуально для кожної окремої дошки.',
  'Note template': 'Шаблон нотатки',
  'This template will be used when creating new notes from Kanban cards.':
    'Цей шаблон використовуватиметься під час створення нових нотаток з карток Kanban.',
  'No template': 'Без шаблону',
  'Note folder': 'Папка нотаток',
  'Notes created from Kanban cards will be placed in this folder. If blank, they will be placed in the default location for this vault.':
    'Нотатки, створені з карток Kanban, зберігатимуться в цій папці. Якщо поле порожнє, вони потраплятимуть у типове розташування сховища.',
  'Default folder': 'Типова папка',
  'List width': 'Ширина списку',
  'Expand lists to full width in list view': 'Розгортати списки на всю ширину у режимі списку',
  'Enter a number to set the list width in pixels.':
    'Введіть число, щоб налаштувати ширину списку в пікселях.',
  'Maximum number of archived cards': 'Максимальна кількість архівованих карток',
  "Archived cards can be viewed in markdown mode. This setting will begin removing old cards once the limit is reached. Setting this value to -1 will allow a board's archive to grow infinitely.":
    'Архівовані картки можна переглядати в режимі Markdown. Старі картки видалятимуться після досягнення ліміту. Значення -1 дозволяє архіву зростати без обмежень.',
  'Display card checkbox': 'Відображати чекбокс картки',
  'When toggled, a checkbox will be displayed with each card':
    'Якщо увімкнено, біля кожної картки показуватиметься чекбокс',
  'Reset to default': 'Скинути до типових',
  'Date & Time': 'Дата й час',
  'Date trigger': 'Тригер дати',
  'When this is typed, it will trigger the date selector':
    'Введення цього символу викличе меню вибору дати',
  'Time trigger': 'Тригер часу',
  'When this is typed, it will trigger the time selector':
    'Введення цього символу викличе меню вибору часу',
  'Date format': 'Формат дати',
  'This format will be used when saving dates in markdown.':
    'Цей формат використовуватиметься під час збереження дат у Markdown.',
  'For more syntax, refer to': 'Детальніше про синтаксис див.',
  'format reference': 'довідку з форматування',
  'Your current syntax looks like this': 'Ваш поточний синтаксис виглядає так',
  'Time format': 'Формат часу',
  'Date display format': 'Формат показу дати',
  'This format will be used when displaying dates in Kanban cards.':
    'Цей формат застосовуватиметься під час відображення дат на картках Kanban.',
  'Show relative date': 'Показувати відносну дату',
  "When toggled, cards will display the distance between today and the card's date. eg. 'In 3 days', 'A month ago'. Relative dates will not be shown for dates from the Tasks and Dataview plugins.":
    'Якщо увімкнено, картки показуватимуть часову відстань до дати картки (наприклад, "Через 3 дні", "Місяць тому"). Не діє на дати з плагінів Tasks та Dataview.',

  'Move dates to card footer': 'Перемістити дати у підвал картки',
  "When toggled, dates will be displayed in the card's footer instead of the card's body.":
    'Якщо увімкнено, дати показуватимуться у підвалі картки, а не в її тілі.',
  'Move tags to card footer': 'Перемістити теги у підвал картки',
  "When toggled, tags will be displayed in the card's footer instead of the card's body.":
    'Якщо увімкнено, теги показуватимуться у підвалі картки, а не в її тілі.',
  'Move task data to card footer': 'Перемістити дані завдань у підвал картки',
  "When toggled, task data (from the Tasks plugin) will be displayed in the card's footer instead of the card's body.":
    'Якщо увімкнено, дані завдань (з плагіна Tasks) показуватимуться у підвалі картки.',
  'Inline metadata position': 'Розташування вбудованих метаданих',
  'Controls where the inline metadata (from the Dataview plugin) will be displayed.':
    'Керує тим, де саме відображаються рядкові метадані з плагіна Dataview.',
  'Card body': 'Тіло картки',
  'Card footer': 'Підвал картки',
  'Merge with linked page metadata': "Об'єднати з метаданими зв'язаної сторінки",

  'Hide card counts in list titles': 'Приховати кількість карток у назвах списків',
  'When toggled, card counts are hidden from the list title':
    'Якщо увімкнено, лічильник карток буде приховано із заголовка списку',
  'Link dates to daily notes': 'Посилатися датами на щоденні нотатки',
  'When toggled, dates will link to daily notes. Eg. [[2021-04-26]]':
    'Якщо увімкнено, дати стануть вікілінками на щоденні нотатки: [[2021-04-26]]',
  'Add date and time to archived cards': 'Додавати дату й час до архівованих карток',
  'When toggled, the current date and time will be added to the card title when it is archived. Eg. - [ ] 2021-05-14 10:00am My card title':
    'Якщо увімкнено, поточні дата й час додаватимуться до назви картки під час архівації (наприклад: - [ ] 14.05.2021 10:00 Заголовок картки)',
  'Add archive date/time after card title': 'Додавати дату/час архівації після назви картки',
  'When toggled, the archived date/time will be added after the card title, e.g.- [ ] My card title 2021-05-14 10:00am. By default, it is inserted before the title.':
    'Якщо увімкнено, дата/час архівації додаватиметься в кінці назви картки. За замовчуванням вона ставиться попереду.',
  'Archive date/time separator': 'Роздільник дати/часу архівації',
  'This will be used to separate the archived date/time from the title':
    'Використовується для відокремлення мітки дати/часу від тексту картки',
  'Archive date/time format': 'Формат дати/часу архівації',
  'Kanban Plugin': 'Плагін Kanban',
  'Tag click action': 'Дія під час натискання на тег',
  'Search Kanban Board': 'Пошук на дошці Kanban',
  'Search Obsidian Vault': 'Пошук у сховищі Obsidian',
  'This setting controls whether clicking the tags displayed below the card title opens the Obsidian search or the Kanban board search.':
    'Визначає, що відкривається під час кліку на тег під карткою: глобальний пошук Obsidian чи локальний фільтр дошки Kanban.',
  'Tag colors': 'Кольори тегів',
  'Set colors for tags displayed in cards.': 'Налаштувати колірне оформлення тегів на картках.',
  'Linked Page Metadata': "Метадані зв'язаної сторінки",
  'Inline Metadata': 'Вбудовані метадані',
  'Display metadata for the first note linked within a card. Specify which metadata keys to display below. An optional label can be provided, and labels can be hidden altogether.':
    'Відображати метадані першої нотатки, на яку є посилання в картці. Нижче вкажіть потрібні ключі.',
  'Board Header Buttons': 'Кнопки у верхній панелі дошки',
  'Calendar: first day of week': 'Календар: перший день тижня',
  'Override which day is used as the start of the week':
    'Перевизначити перший день тижня для внутрішнього календаря',
  Sunday: 'Неділя',
  Monday: 'Понеділок',
  Tuesday: 'Вівторок',
  Wednesday: 'Середа',
  Thursday: 'Четвер',
  Friday: "П'ятниця",
  Saturday: 'Субота',
  'Background color': 'Колір фону',
  Tag: 'Тег',
  'Text color': 'Колір тексту',
  'Date is': 'Дата:',
  Today: 'Сьогодні',
  'After now': 'Пізніше за поточний момент',
  'Before now': 'Раніше за поточний момент',
  'Between now and': 'У проміжку між зараз та',
  'Display date colors': 'Колірне виділення дат',
  'Set colors for dates displayed in cards based on the rules below.':
    'Задайте правила підсвічування дат на картках.',
  'Add date color': 'Додати правило кольору дати',

  // MetadataSettings.tsx
  'Metadata key': 'Ключ метаданих',
  'Display label': 'Підпис для показу',
  'Hide label': 'Сховати підпис',
  'Drag to rearrange': 'Потягніть для перевпорядкування',
  Delete: 'Видалити',
  'Add key': 'Додати ключ',
  'Add tag': 'Додати тег',
  'Field contains markdown': 'Поле містить Markdown',
  'Tag sort order': 'Порядок сортування тегів',
  'Set an explicit sort order for the specified tags.':
    'Задати чіткий порядок сортування для вказаних тегів.',

  // TagColorSettings.tsx
  'Add tag color': 'Додати колір тегу',

  // components/Table.tsx
  List: 'Список',
  Card: 'Картка',
  Date: 'Дата',
  Tags: 'Теги',

  Priority: 'Пріоритет',
  Start: 'Початок',
  Created: 'Створено',
  Scheduled: 'Заплановано',
  Due: 'Дедлайн',
  Cancelled: 'Скасовано',
  Recurrence: 'Повторення',
  'Depends on': 'Залежить від',
  ID: 'ID',

  // components/Item/Item.tsx
  'More options': 'Більше дій',
  Cancel: 'Скасувати',
  Done: 'Готово',
  Save: 'Зберегти',

  // components/Item/ItemContent.tsx
  today: 'сьогодні',
  yesterday: 'вчора',
  tomorrow: 'завтра',
  'Change date': 'Змінити дату',
  'Change time': 'Змінити час',

  // components/Item/ItemForm.tsx
  'Card title...': 'Назва картки...',
  'Add card': 'Додати картку',
  'Add a card': 'Додати картку',

  // components/Item/ItemMenu.ts
  'Edit card': 'Редагувати картку',
  'New note from card': 'Створити нотатку з картки',
  'Archive card': 'Архівувати картку',
  'Delete card': 'Видалити картку',
  'Edit date': 'Змінити дату',
  'Add date': 'Додати дату',
  'Remove date': 'Видалити дату',
  'Edit time': 'Змінити час',
  'Add time': 'Додати час',
  'Remove time': 'Видалити час',
  'Duplicate card': 'Дублювати картку',
  'Split card': 'Розділити картку',
  'Copy link to card': 'Скопіювати посилання на картку',
  'Insert card before': 'Вставити картку перед цією',
  'Insert card after': 'Вставити картку після цієї',
  'Add label': 'Додати мітку',
  'Move to top': 'Перемістити на самий початок',
  'Move to bottom': 'Перемістити в самий кінець',
  'Move to list': 'Перемістити до списку',

  // components/Lane/LaneForm.tsx
  'Enter list title...': 'Введіть назву списку...',
  'Mark cards in this list as complete': 'Позначати картки в цьому списку завершеними',
  'Add list': 'Додати список',
  'Add a list': 'Додати список',

  // components/Lane/LaneHeader.tsx
  'Move list': 'Перемістити список',
  Close: 'Закрити',

  // components/Lane/LaneMenu.tsx
  'Are you sure you want to delete this list and all its cards?':
    'Справді видалити цей список разом з усіма картками?',
  'Yes, delete list': 'Так, видалити список',
  'Are you sure you want to archive this list and all its cards?':
    'Справді архівувати цей список та всі його картки?',
  'Yes, archive list': 'Так, архівувати список',
  'Are you sure you want to archive all cards in this list?':
    'Справді архівувати всі картки в цьому списку?',
  'Yes, archive cards': 'Так, архівувати картки',
  'Edit list': 'Редагувати назву списку',
  'Archive cards': 'Архівувати картки',
  'Archive list': 'Архівувати список',
  'Delete list': 'Видалити список',
  'Insert list before': 'Вставити список перед цим',
  'Insert list after': 'Вставити список після цього',
  'Sort by card text': 'Сортувати за текстом картки',
  'Sort by date': 'Сортувати за датою',
  'Sort by tags': 'Сортувати за тегами',
  'Sort by': 'Сортувати за',

  // components/helpers/renderMarkdown.ts
  'Unable to find': 'Не знайдено',
  'Open in default app': 'Відкрити в системній програмі за замовчуванням',

  // components/Editor/MarkdownEditor.tsx
  Submit: 'Зберегти',
};

export default lang;
