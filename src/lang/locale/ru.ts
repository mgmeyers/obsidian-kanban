// русский
import { Lang } from './en';

const lang: Partial<Lang> = {
  // main.ts
  'Open as kanban board': 'Открыть как Kanban-доску',
  'Create new board': 'Создать новую доску',
  'Archive completed cards in active board': 'Архивировать завершённые карточки в активной доске',
  'Error: current file is not a Kanban board': 'Ошибка: текущий файл не является Kanban-доской',
  'Convert empty note to Kanban': 'Конвертировать пустую заметку в Kanban',
  'Error: cannot create Kanban, the current note is not empty':
    'Ошибка: невозможно создать Kanban, текущая заметка не пуста',
  'New kanban board': 'Новая Kanban-доска',
  'Untitled Kanban': 'Безымянная Kanban-доска',
  'Toggle between Kanban and markdown mode': 'Переключиться между Kanban и markdown режимами',
  'Board view': 'Вид доски',

  // KanbanView.tsx
  'Open as markdown': 'Открыть как Markdown',
  'Open board settings': 'Открыть настройки доски',
  'Archive completed cards': 'Архивировать выполненные карточки',
  'Something went wrong': 'Что-то пошло не так',
  'You may wish to open as markdown and inspect or edit the file.':
    'Вы можете открыть файл как markdown и проверить или отредактировать его.',
  'Are you sure you want to archive all completed cards on this board?':
    'Вы уверены, что хотите архивировать все завершёённые карточки в этой доске?',

  // parser.ts
  Complete: 'Выполнено',
  Archive: 'Архивировать',
  'Invalid Kanban file: problems parsing frontmatter':
    'Неверный файл Kanban: не удаётся парсинг frontmatter',
  "I don't know how to interpret this line:": 'Я не знаю, как интерпретировать эту строку:',
  Untitled: 'Без имени', // auto-created column

  // settingHelpers.ts
  'Note: No template plugins are currently enabled.':
    'Примечание: В настоящее время ни один плагин шаблона не включен.',
  default: 'по умолчанию',
  'Search...': 'Поиск…',

  // Settings.ts
  'New line trigger': 'Горячая клавиша для новой строки',
  'Select whether Enter or Shift+Enter creates a new line. The opposite of what you choose will create and complete editing of cards and lists.':
    'Выберите, что создаёт новую строку: Enter или Shift+Enter. Другая комбинация завершает редактирование карточек и списков.',
  'Shift + Enter': 'Shift + Enter',
  Enter: 'Enter',
  'Prepend / append new cards': 'Добавлять новые карточки в начало / конец списка',
  'This setting controls whether new cards are added to the beginning or end of the list.':
    'Настраивает, добавлять ли новые карточки в начало или в конец списка.',
  Prepend: 'В начале',
  'Prepend (compact)': 'В начале (компактно)',
  Append: 'В конце',
  'These settings will take precedence over the default Kanban board settings.':
    'Эти настройки имеют приоритет над настройками Канбан по умолчанию.',
  'Set the default Kanban board settings. Settings can be overridden on a board-by-board basis.':
    'Настройте значения по умолчанию. Их можно переопределить для каждой доски.',
  'Note template': 'Шаблон заметки',
  'This template will be used when creating new notes from Kanban cards.':
    'Этот шаблон используется при создании заметок из карточек.',
  'No template': 'Нет шаблона',
  'Note folder': 'Папка для заметок',
  'Notes created from Kanban cards will be placed in this folder. If blank, they will be placed in the default location for this vault.':
    'Заметки из карточек будут сохранены в этой папке; если пусто — в папку по умолчанию.',
  'Default folder': 'Директория по умолчанию',
  'List width': 'Ширина списка',
  'Expand lists to full width in list view': 'Растягивать списки на всю ширину в режиме списка',
  'Enter a number to set the list width in pixels.':
    'Укажите число — ширина списка в пикселях.',
  'Maximum number of archived cards': 'Максимум карточек в архиве',
  "Archived cards can be viewed in markdown mode. This setting will begin removing old cards once the limit is reached. Setting this value to -1 will allow a board's archive to grow infinitely.":
    'Архивные карточки видны в Markdown. При достижении лимита старые удаляются. Значение -1 — без лимита.',
  'Display card checkbox': 'Показывать чекбокс у карточек',
  'When toggled, a checkbox will be displayed with each card':
    'При включении у каждой карточки будет чекбокс',
  'Reset to default': 'Сбросить настройки',
  'Date & Time': 'Дата и время',
  'Date trigger': 'Триггер даты',
  'When this is typed, it will trigger the date selector':
    'Ввод этого триггера открывает выбор даты',
  'Time trigger': 'Триггер времени',
  'When this is typed, it will trigger the time selector': 'Ввод активирует выбор времени',
  'Date format': 'Формат даты',
  'This format will be used when saving dates in markdown.':
    'Этот формат используется при сохранении даты в Markdown.',
  'For more syntax, refer to': 'Полный синтаксис смотрите на',
  'format reference': 'справка по формату',
  'Your current syntax looks like this': 'Ваш текущий синтаксис выглядит так',
  'Time format': 'Формат времени',
  'Date display format': 'Формат отображения даты',
  'This format will be used when displaying dates in Kanban cards.':
    'Этот формат используется при показе дат на карточках.',
  'Show relative date': 'Показывать относительную дату',
  "When toggled, cards will display the distance between today and the card's date. eg. 'In 3 days', 'A month ago'. Relative dates will not be shown for dates from the Tasks and Dataview plugins.":
    'При включении показывается разница до/от текущей даты (например, «Через 3 дня», «Месяц назад»). Не применяется к датам из Tasks/Dataview.',
  'Move dates to card footer': 'Перемещать даты в подвал карточки',
  'Move tags to card footer': 'Перемещать теги в подвал карточки',
  'Move task data to card footer': 'Перемещать данные задачи в подвал карточки',
  'Inline Metadata': 'Встроенные метаданные',
  'Controls where the inline metadata (from the Dataview plugin) will be displayed.':
    'Определяет, где показывать встроенные метаданные (Dataview).',
  'Card body': 'Тело карточки',
  'Card footer': 'Подвал карточки',
  'Merge with linked page metadata': 'Объединить с метаданными связанной страницы',
  'Hide card counts in list titles': 'Скрывать счётчик карточек в заголовке списка',
  'When toggled, card counts are hidden from the list title':
    'При включении счётчики карточек не показываются в заголовке списка.',
  'Link dates to daily notes': 'Привязывать даты к ежедневным заметкам',
  'When toggled, dates will link to daily notes. Eg. [[2021-04-26]]':
    'Когда включено, даты будут указывать на ежедневные заметки. Например, [[2021-04-26]]',
  'Add date and time to archived cards': 'Добавлять дату/время в архивируемые карточки',
  'When toggled, the current date and time will be added to the card title when it is archived. Eg. - [ ] 2021-05-14 10:00am My card title':
    'Когда включено, текущие дата и время будут добавлены к заголовку карточки, когда она заархивирована. Например, - [ ] 2021-05-14 10:00am Мой заголовок карточки',
  'Add archive date/time after card title':
    'Добавлять дату/время архива после заголовка',
  'When toggled, the archived date/time will be added after the card title, e.g.- [ ] My card title 2021-05-14 10:00am. By default, it is inserted before the title.':
    'Когда включено, дата и время архивирования будет добавлено после заголовка карточки, например, - [ ] Мой заголовок карточки 2021-05-14 10:00am. По умолчанию добавление производится перед заголовком.',
  'Archive date/time separator': 'Разделитель даты/времени архива',
  'This will be used to separate the archived date/time from the title':
    'Будет использоваться для отделения даты/времени архивирования от заголовка',
  'Archive date/time format': 'Формат даты/времени архива',
  'Kanban Plugin': 'Плагин Kanban',
  Tags: 'Теги',
  'Tag click action': 'Действие по клику на тег',
  'This setting controls whether clicking the tags displayed below the card title opens the Obsidian search or the Kanban board search.':
    'Определяет, открывать ли поиск Obsidian или поиск по доске при клике на тег.',
  'Tag colors': 'Цвета тегов',
  'Set colors for tags displayed in cards.': 'Настройте цвета тегов в карточках.',
  'Linked Page Metadata': 'Метаданные связанной страницы',
  'Display metadata for the first note linked within a card. Specify which metadata keys to display below. An optional label can be provided, and labels can be hidden altogether.':
    'Показывать метаданные первой ссылки в карточке. Укажите ключи ниже; можно задать метки или скрыть их.',
  'Board Header Buttons': 'Кнопки шапки доски',
  'Calendar: first day of week': 'Календарь: первый день недели',
  'Override which day is used as the start of the week':
    'Укажите, какой день должен использоваться как начало недели',
  Sunday: 'Воскресенье',
  Monday: 'Понедельник',
  Tuesday: 'Вторник',
  Wednesday: 'Среда',
  Thursday: 'Четверг',
  Friday: 'Пятница',
  Saturday: 'Суббота',
  'Background color': 'Цвет фона',
  Tag: 'Метка',
  'Text color': 'Цвет текста',
  'Date is': 'Дата',
  Today: 'Сегодня',
  'After now': 'После текущего момента',
  'Before now': 'До текущего момента',
  'Between now and': 'Между сейчас и',
  'Display date colors': 'Показывать цвета дат',
  'Set colors for dates displayed in cards based on the rules below.':
    'Настройте цвета дат по правилам ниже.',
  'Add date color': 'Добавить правило цвета даты',

  // MetadataSettings.tsx
  'Metadata key': 'Ключ метаданных',
  'Display label': 'Показать ярылк',
  'Hide label': 'Спрятать ярлык',
  'Drag to rearrange': 'Потяните, чтобы переупорядочить',
  Delete: 'Удалить',
  'Add key': 'Добавить ключ',
  'Field contains markdown': 'Поле содержит markdown',
  'Tag sort order': 'Порядок сортировки тегов',
  'Set an explicit sort order for the specified tags.':
    'Задайте явный порядок для выбранных тегов.',

  // TagColorSettings.tsx
  'Add tag color': 'Добавить цвет для тега',

  // components/Item/Item.tsx
  'More options': 'Больше настроек',
  Cancel: 'Отмена',

  // components/Item/ItemContent.tsx
  today: 'сегодня',
  yesterday: 'вчера',
  tomorrow: 'завтра',
  'Change date': 'Изменить дату',
  'Change time': 'Изменить время',

  // components/Item/ItemForm.tsx
  'Card title...': 'Заголовок карточки...',
  'Add card': 'Добавить карточку',
  'Add a card': 'Добавить карточку',

  // components/Item/ItemMenu.ts
  'Edit card': 'Редактировать карточку',
  'New note from card': 'Новая заметка из карточки',
  'Archive card': 'Архивировать карточку',
  'Delete card': 'Удалить карточку',
  'Edit date': 'Редактировать дату',
  'Add date': 'Добавить дату',
  'Remove date': 'Удалить дату',
  'Edit time': 'Редактировать время',
  'Add time': 'Добавить время',
  'Remove time': 'Удалить время',
  'Duplicate card': 'Дублировать карточку',
  'Split card': 'Разделить карточку',
  'Copy link to card': 'Скопировать ссылку на карточку',
  'Insert card before': 'Вставить карточку до',
  'Insert card after': 'Вставить карточку после',
  'Add label': 'Добавить ярлык',
  'Move to top': 'Переместить вверх',
  'Move to bottom': 'Переместить вниз',

  // components/Lane/LaneForm.tsx
  'Enter list title...': 'Введите заголовок списка...',
  'Mark cards in this list as complete': 'Отметить карточки в этом списке как завершённые',
  'Add list': 'Добавить список',
  'Add a list': 'Добавить список',

  // components/Lane/LaneHeader.tsx
  'Move list': 'Переместить список',
  Close: 'Закрыть',

  // components/Lane/LaneMenu.tsx
  'Are you sure you want to delete this list and all its cards?':
    'Удалить этот список и все его карточки?',
  'Yes, delete list': 'Да, удалить список',
  'Are you sure you want to archive this list and all its cards?':
    'Архивировать этот список и все его карточки?',
  'Yes, archive list': 'Да, архивировать список',
  'Are you sure you want to archive all cards in this list?':
    'Архивировать все карточки в этом списке?',
  'Yes, archive cards': 'Да, архивировать карточки',
  'Edit list': 'Редактировать список',
  'Archive cards': 'Архивировать карточки',
  'Archive list': 'Архивировать список',
  'Delete list': 'Удалить список',
  'Insert list before': 'Вставить список до',
  'Insert list after': 'Вставить список после',
  'Sort by card text': 'Сортировать по тексту карточки',
  'Sort by date': 'Сортировать по дате',

  // components/helpers/renderMarkdown.ts
  'Unable to find': 'Невозможно найти',
  'Open in default app': 'Открыть в приложении по умолчанию',

  // components/Editor/MarkdownEditor.tsx
  Submit: 'Сохранить',
};

export default lang;
