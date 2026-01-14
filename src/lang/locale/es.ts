// Español
import { Lang } from "./en";

const lang: Partial<Lang> = {
	"Open as kanban board": "Abrir como tablero kanban",
	"Create new board": "Crear nuevo tablero",
	"Archive completed cards in active board":
		"Archivar tarjetas completadas en el tablero activo",
	"Error: current file is not a Kanban board":
		"Error: el archivo actual no es un tablero Kanban",
	"Convert empty note to Kanban": "Convertir nota vacia en un Kanban",
	"Error: cannot create Kanban, the current note is not empty":
		"Error: No se puede crear el Kanban, la nota actual no está vacía",
	"New kanban board": "Nuevo tablero Kanban",
	"Untitled Kanban": "Kanban sin título",
	"Toggle between Kanban and markdown mode":
		"Cambiar entre Kanban y modo markdown",

	"View as board": "Ver como tablero",
	"View as list": "Ver como lista",
	"View as table": "Ver como tabla",
	"Board view": "Vista del tablero",

	// KanbanView.tsx
	"Open as markdown": "Abrir como markdown",
	"Open board settings": "Abrir ajustes del tablero",
	"Archive completed cards": "Archivar tarjetas completadas",
	"Something went wrong": "Algo salió mal",
	"You may wish to open as markdown and inspect or edit the file.":
		"Es posible que desees abrirlo como markdown e inspeccionar o editar el archivo.",
	"Are you sure you want to archive all completed cards on this board?":
		"¿Seguro que deseas archivar todas las tarjetas completadas en este tablero?",

	// parser.ts
	Complete: "Completado",
	Archive: "Archivado",
	"Invalid Kanban file: problems parsing frontmatter":
		"Archivo Kanban no válido: problemas al analizar el frontmatter",
	"I don't know how to interpret this line:":
		"No sé cómo interpretar esta línea:",
	Untitled: "Sin título", // auto-created column

	// settingHelpers.ts
	"Note: No template plugins are currently enabled.":
		"Nota: No hay complementos de plantilla habilitados actualmente.",
	default: "Por defecto",
	"Search...": "Buscar...",

	// Settings.ts
	"New line trigger": "Nueva linea",
	"Select whether Enter or Shift+Enter creates a new line. The opposite of what you choose will create and complete editing of cards and lists.":
		"Presionar Enter o Shift+Enter creara una nueva línea. Lo opuesto que elija creará y completará la edición en tarjetas y listas.",
	"Shift + Enter": "Shift + Enter",
	Enter: "Enter",
	"Prepend / append new cards": "Anteponer / añadir nuevas tarjetas",
	"This setting controls whether new cards are added to the beginning or end of the list.":
		"Controla si las nuevas tarjetas se agregan al principio o al final de la lista.",
	Prepend: "Anteponer",
	"Prepend (compact)": "Anteponer (compacto)",
	Append: "Añadir",
	"These settings will take precedence over the default Kanban board settings.":
		"Estas configuraciones tendrán prioridad sobre las configuraciones predeterminadas del tablero Kanban.",
	"Set the default Kanban board settings. Settings can be overridden on a board-by-board basis.":
		"Establezca la configuración predeterminada del tablero Kanban. La configuración puede cambiarse en cada tablero.",
	"Note template": "Plantilla de nota",
	"This template will be used when creating new notes from Kanban cards.":
		"Esta plantilla se utilizará al crear nuevas notas a partir de tarjetas Kanban.",
	"No template": "Sin plantilla",
	"Note folder": "Carpeta de notas",
	"Notes created from Kanban cards will be placed in this folder. If blank, they will be placed in the default location for this vault.":
		"Las notas creadas desde tarjetas Kanban se colocarán en esta carpeta. Si está en blanco, se colocarán en la ubicación predeterminada de esta bóveda.",
	"Default folder": "Carpeta predeterminada",
	"List width": "Ancho de lista",
	"Expand lists to full width in list view":
		"Ampliar listas al ancho completo en la vista de lista",
	"Enter a number to set the list width in pixels.":
		"Introduzca un número para establecer el ancho de la lista en píxeles.",
	"Maximum number of archived cards": "Número máximo de tarjetas archivadas",
	"Archived cards can be viewed in markdown mode. This setting will begin removing old cards once the limit is reached. Setting this value to -1 will allow a board's archive to grow infinitely.":
		"Las tarjetas archivadas pueden verse en el modo markdown. Esta configuración eliminara las tarjetas antiguas una vez que se alcance el límite. Si se establece este valor en -1, el archivador de un tablero podrá aumentar infinitamente.",
	"Display card checkbox": "Mostar caja de verificación",
	"When toggled, a checkbox will be displayed with each card":
		"Cuando se activa, se mostrará una caja de verificación en cada tarjeta.",
	"Reset to default": "Restablecer a valores predeterminados",
	"Date & Time": "Fecha y hora",
	"Date trigger": "Disparador de fecha",
	"When this is typed, it will trigger the date selector":
		"Cuando se escribe esto, se activará el selector de fecha.",
	"Time trigger": "Disparador de tiempo",
	"When this is typed, it will trigger the time selector":
		"Cuando se escribe esto, se activará el selector de tiempo.",
	"Date format": "Formato de fecha",
	"This format will be used when saving dates in markdown.":
		"Este formato se utilizará al guardar fechas en markdown.",
	"For more syntax, refer to": "Para más sintaxis, consulte",
	"format reference": "formato de referencia",
	"Your current syntax looks like this": "Su sintaxis actual se ve así",
	"Time format": "Formato de hora",
	"Date display format": "Formato de fecha",
	"This format will be used when displaying dates in Kanban cards.":
		"Este formato se utilizará al mostrar fechas en tarjetas Kanban",
	"Show relative date": "Mostrar fecha relativa",
	"When toggled, cards will display the distance between today and the card's date. eg. 'In 3 days', 'A month ago'. Relative dates will not be shown for dates from the Tasks and Dataview plugins.":
		'Si se activa, las tarjetas mostrarán la distancia entre hoy y la fecha de la tarjeta, por ejemplo, "En 3 días", "Hace un mes". No se mostrarán las fechas relativas para fechas de los complementos Tasks y Dataview.',

	"Move dates to card footer": "Mover fechas al pie de página de la tarjeta",
	"When toggled, dates will be displayed in the card's footer instead of the card's body.":
		"Si se activa, las fechas se mostrarán en el pie de página de la tarjeta en lugar del cuerpo de la tarjeta.",
	"Move tags to card footer": "Mover etiquetas al pie de página de la tarjeta",
	"When toggled, tags will be displayed in the card's footer instead of the card's body.":
		"Si se activa, las etiquetas se mostrarán en el pie de página de la tarjeta en lugar del cuerpo de la tarjeta.",
	"Move task data to card footer":
		"Mover los datos de la tarea al pie de página de la tarjeta",
	"When toggled, task data (from the Tasks plugin) will be displayed in the card's footer instead of the card's body.":
		"Si se activa, los datos de la tarea (del complemento Tasks) se mostrarán en el pie de página de la tarjeta en lugar del cuerpo de la tarjeta.",
	"Inline metadata position": "Posición de metadatos en línea",
	"Controls where the inline metadata (from the Dataview plugin) will be displayed.":
		"Controla dónde se mostrarán los metadatos en línea (del complemento Dataview).",
	"Card body": "Cuerpo de la tarjeta",
	"Card footer": "Pie de página de la tarjeta",
	"Merge with linked page metadata":
		"Fusionar con metadatos de la página vinculada",

	"Hide card counts in list titles":
		"Ocultar el número de tarjetas en los títulos de lista",
	"When toggled, card counts are hidden from the list title":
		"Si se activa, el contador de tarjetas se ocultara del título de la lista.",
	"Link dates to daily notes": "Vincular fechas a notas diarias",
	"When toggled, dates will link to daily notes. Eg. [[2021-04-26]]":
		"Si se activa, las fechas se vincularán a las notas diarias. Por ejemplo: [[2021-04-26]]",
	"Add date and time to archived cards":
		"Añadir fecha y hora a las tarjetas archivadas",
	"When toggled, the current date and time will be added to the card title when it is archived. Eg. - [ ] 2021-05-14 10:00am My card title":
		"Si se activa, la fecha y la hora actuales se agregarán al título de la tarjeta cuando se archive. Por ejemplo: - [ ] 2021-05-14 10:00 a. m. Título de mi tarjeta",

	"Add archive date/time after card title":
		"Añadir fecha y hora de archivación después del título de la tarjeta",
	"When toggled, the archived date/time will be added after the card title, e.g.- [ ] My card title 2021-05-14 10:00am. By default, it is inserted before the title.":
		"Si se activa, la fecha/hora de archivación se agregarán después del título de la tarjeta, por ejemplo: [ ] Título de mi tarjeta 2021-05-14 10:00 a. m. De manera predeterminada, se inserta antes del título.",
	"Archive date/time separator": "Separador de fecha/hora de archivación",
	"This will be used to separate the archived date/time from the title":
		"Esto se utilizará para separar la fecha/hora archivada del título.",
	"Archive date/time format": "Formato de fecha/hora de archivación",
	"Kanban Plugin": "Complemento Kanban",
	"Tag click action": "Acción al hacer clic en la etiqueta",
	"Search Kanban Board": "Buscar en el tablero Kanban",
	"Search Obsidian Vault": "Buscar en la Bóveda de Obsidian",
	"This setting controls whether clicking the tags displayed below the card title opens the Obsidian search or the Kanban board search.":
		"Controla si al hacer clic en las etiquetas bajo el título de la tarjeta abrirá la búsqueda de Obsidian o la búsqueda del tablero Kanban.",
	"Tag colors": "Colores de etiqueta",
	"Set colors for tags displayed in cards.":
		"Establecer colores para las etiquetas que se muestran en las tarjetas.",
	"Linked Page Metadata": "Metadatos de la página vinculada",
	"Inline Metadata": "Metadatos en línea",
	"Display metadata for the first note linked within a card. Specify which metadata keys to display below. An optional label can be provided, and labels can be hidden altogether.":
		"Muestra los metadatos de la primera nota vinculada dentro de una tarjeta. Especifica qué metadatos quieres mostrar a continuación. Se puede proporcionar una etiqueta opcional y pueden ocultarse por completo.",
	"Board Header Buttons": "Botones del encabezado del tablero",
	"Calendar: first day of week": "Calendario: primer día de la semana",
	"Override which day is used as the start of the week":
		"Cambiar qué día se utiliza como inicio de la semana",
	Sunday: "Domingo",
	Monday: "Lunes",
	Tuesday: "Martes",
	Wednesday: "Miércoles",
	Thursday: "Jueves",
	Friday: "Viernes",
	Saturday: "Sábado",
	"Background color": "Color de fondo",
	Tag: "Etiqueta",
	"Text color": "Color del texto",
	"Date is": "La fecha es",
	Today: "Hoy",
	"After now": "Despues de hoy",
	"Before now": "Antes de hoy",
	"Between now and": "Entre hoy y",
	"Display date colors": "Mostrar colores de fecha",
	"Set colors for dates displayed in cards based on the rules below.":
		"Establezca colores para las fechas que se muestran en las tarjetas según las reglas siguientes.",
	"Add date color": "Añadir color de fecha",

	// MetadataSettings.tsx
	"Metadata key": "Clave de metadatos",
	"Display label": "Etiqueta a mostrar",
	"Hide label": "Ocultar etiqueta",
	"Drag to rearrange": "Arrastre para reorganizar",
	Delete: "Eliminar",
	"Add key": "Añadir clave",
	"Add tag": "Añadir etiqueta",
	"Field contains markdown": "El campo contiene markdown",
	"Tag sort order": "Orden de clasificación de etiquetas",
	"Set an explicit sort order for the specified tags.":
		"Establecer un orden de clasificación explícito para las etiquetas especificadas",

	// TagColorSettings.tsx
	"Add tag color": "Añadir color de etiqueta",

	// components/Table.tsx
	List: "Lista",
	Card: "Tarjeta",
	Date: "Fecha",
	Tags: "Etiquetas",

	Priority: "Prioridad",
	Start: "Inició",
	Created: "Creado",
	Scheduled: "Programado",
	Due: "Pendiente",
	Cancelled: "Cancelado",
	Recurrence: "Recurrencia",
	"Depends on": "Depende de",
	ID: "ID",

	// components/Item/Item.tsx
	"More options": "Más opciones",
	Cancel: "Cancelar",
	Done: "Listo",
	Save: "Guardar",

	// components/Item/ItemContent.tsx
	today: "hoy",
	yesterday: "ayer",
	tomorrow: "mañana",
	"Change date": "Cambiar fecha",
	"Change time": "Cambiar hora",

	// components/Item/ItemForm.tsx
	"Card title...": "Título de la tarjeta...",
	"Add card": "Añadir tarjeta",
	"Add a card": "Añadir tarjeta",

	// components/Item/ItemMenu.ts
	"Edit card": "Editar tarjeta",
	"New note from card": "Nueva nota desde la tarjeta",
	"Archive card": "Archivar tarjeta",
	"Delete card": "Eliminar tarjeta",
	"Edit date": "Editar fecha",
	"Add date": "Añadir fecha",
	"Remove date": "Remover fecha",
	"Edit time": "Editar hora",
	"Add time": "Añadir hora",
	"Remove time": "Remover hora",
	"Duplicate card": "Duplicar tarjeta",
	"Split card": "Dividir tarjeta",
	"Copy link to card": "Copiar enlace a la tarjeta",
	"Insert card before": "Insertar tarjeta antes",
	"Insert card after": "Insertar tarjeta después",
	"Add label": "Añadir etiqueta",
	"Move to top": "Mover hacia arriba",
	"Move to bottom": "Mover hacia abajo",
	"Move to list": "Mover a la lista",

	// components/Lane/LaneForm.tsx
	"Enter list title...": "Introduzca el título de la lista...",
	"Mark cards in this list as complete":
		"Marcar tarjetas en esta lista como completadas",
	"Add list": "Añadir lista",
	"Add a list": "Añadir lista",

	// components/Lane/LaneHeader.tsx
	"Move list": "Mover lista",
	Close: "Cerrar",

	// components/Lane/LaneMenu.tsx
	"Are you sure you want to delete this list and all its cards?":
		"¿Seguro que deseas eliminar esta lista junto a todas sus tarjetas?",
	"Yes, delete list": "Sí, elimina la lista",
	"Are you sure you want to archive this list and all its cards?":
		"¿Seguro que deseas archivar esta lista y todas sus tarjetas?",
	"Yes, archive list": "Sí. archiva la lista",
	"Are you sure you want to archive all cards in this list?":
		"¿Seguro que deseas archivar todas las tarjetas de esta lista?",
	"Yes, archive cards": "Sí, archiva las tarjetas",
	"Edit list": "Editar lista",
	"Archive cards": "Archivar tarjetas",
	"Archive list": "Archivar lista",
	"Delete list": "Eliminar lista",
	"Insert list before": "Insertar lista antes",
	"Insert list after": "Insertar lista después",
	"Sort by card text": "Texto",
	"Sort by date": "Fecha",
	"Sort by tags": "Etiquetas",
	"Sort by": "Ordenar por",

	// components/helpers/renderMarkdown.ts
	"Unable to find": "No se pudo encontrar",
	"Open in default app": "Abrir en la app por defecto",

	// components/Editor/MarkdownEditor.tsx
	Submit: "Enviar",
};

export default lang;
