// Português do Brasil
// Brazilian Portuguese

export default {
  // main.ts
  'Open as Kanban board': 'Abrir como quadro Kanban',
  'Create new board': 'Criar um novo quadro',
  'Archive completed cards in active board':
    'Arquivar cartões concluídos no quadro ativo',
  'Error: current file is not a Kanban board':
    'Erro: o arquivo atual não é um quadro Kanban',
  'Convert empty note to Kanban': 'Converter nota vazia em Kanban',
  'Error: cannot create Kanban, the current note is not empty':
    'Erro: não é possível criar o quadro Kanban, a nota atual não está vazia',
  'New Kanban board': 'Novo quadro Kanban',
  'Untitled Kanban': 'Kanban sem título',
  'Toggle between Kanban and markdown mode':
    'Alternar entre os modos Kanban e Markdown',

  // KanbanView.tsx
  'Open as markdown': 'Abrir como markdown',
  'Open board settings': 'Abrir configurações do quadro Kanban',
  'Archive completed cards': 'Arquivar cartões concluídos',

  // parser.ts
  Complete: 'Concluído',
  Archive: 'Arquivado',

  // settingHelpers.ts
  'Note: No template plugins are currently enabled.':
    'Nota: Não há plug-ins de modelo habilitados no momento.',
  default: 'padrão',
  'Search...': 'Pesquisar...',

  // Settings.ts
  'These settings will take precedence over the default Kanban board settings.':
    'Essas configurações sobrescreverão as configurações padrão do quadro Kanban',
  'Set the default Kanban board settings. Settings can be overridden on a board-by-board basis.':
    'Defina as configurações padrão do quadro Kanban. Cada quadro Kanban pode ter sua própria configuração.',
  'Note template': 'Modelo de nota',
  'This template will be used when creating new notes from Kanban cards.':
    'Este modelo será usado quando uma nova nota Kanban for criada.',
  'No template': 'Sem modelo',
  'Note folder': 'Pasta de notas',
  'Notes created from Kanban cards will be placed in this folder. If blank, they will be placed in the default location for this vault.':
    'As notas criadas pelos links dos cartões Kanban serão colocadas nesta pasta. Se estiver em branco, serão colocadas no local configurado como padrão deste cofre.',
  'Default folder': 'Pasta padrão',
  'Lane width': 'Largura das listas',
  'Enter a number to set the lane width in pixels.':
    'Insira um número para definir a largura das listas em pixels.',
  'Maximum number of archived cards': 'Quantidade máxima de cartões arquivados',
  "Archived cards can be viewed in markdown mode. This setting will begin removing old cards once the limit is reached. Setting this value to -1 will allow a board's archive to grow infinitely.":
    'Os cartões arquivados podem ser vistos no modo Markdown. Esta configuração excluirá os cartões antigos assim que o limite for atingido. Inserir o valor -1 retira o limite para cartões arquivados.',
  'Display card checkbox': 'Exibe uma caixa de seleção do cartão',
  'When toggled, a checkbox will be displayed with each card':
    'Quando ativada, uma caixa de seleção será exibida em cada cartão.',
  'Reset to default': 'Redefinir configurações padrão',
  'Date & Time': 'Data e Hora',
  'Date trigger': 'Gatilho de data',
  'When this is typed, it will trigger the date selector':
    'Quando este caractere é digitado, o seletor de data é exibido.',
  'Time trigger': 'Gatilho de hora',
  'When this is typed, it will trigger the time selector':
    'Quando este caractere é digitado, o seletor de hora é exibido.',
  'Date format': 'Formado da data',
  'This format will be used when saving dates in markdown.':
    'Este formato será usado quando datas forem armazenadas no Markdown.',
  'For more syntax, refer to':
    'Para mais informações sobre esta sintaxe, consulte os',
  'format reference': 'modelos de formato.',
  'Your current syntax looks like this': 'Sua atual sintaxe está assim',
  'Time format': 'Formato da hora',
  'Date display format': 'Formato de exibição da data',
  'This format will be used when displaying dates in Kanban cards.':
    'Este será o formato das datas exibido nos cartões do Kanban.',
  'Show relative date': 'Exibir datas relativas',
  "When toggled, cards will display the distance between today and the card's date. eg. 'In 3 days', 'A month ago'":
    "Ao ativar, os cartões exibirão o intervalo de tempo entre hoje e a data do cartão: Ex.: 'Em 3 dias', 'Um mês atrás'",
  'Hide card display dates': 'Ocultar datas dos cartões',
  'When toggled, formatted dates will not be displayed on the card. Relative dates will still be displayed if they are enabled.':
    'Ao ativar, as datas formatadas não serão exibidas no cartão. As datas relativas ainda serão exibidas se estiverem ativadas.',
  'Hide dates in card titles': 'Ocultar datas dos títulos dos cartões',
  'When toggled, dates will be hidden card titles. This will prevent dates from being included in the title when creating new notes.':
    'Ao ativar, as datas serão títulos de cartões ocultos. Evita que datas sejam incluídas no título ao criar novas notas.',
  'Link dates to daily notes': 'Vincular datas a notas diárias',
  'When toggled, dates will link to daily notes. Eg. [[2021-04-26]]':
    'Ao ativar, as datas serão vinculadas às notas diárias. Ex.: [[2021-04-26]]',
  'Add date and time to archived cards':
    'Adicionar data e hora aos cartões arquivados',
  'When toggled, the current date and time will be added to the card title when it is archived. Eg. - [ ] 2021-05-14 10:00am My card title':
    'Quando ativada, a data e a hora atuais serão adicionadas ao início de um cartão quando ele for arquivado. Ex.: - [] 2021-05-14 10:00 Título do meu cartão',
  'Archive date/time separator': 'Separador de data/hora do arquivo',
  'This will be used to separate the archived date/time from the title':
    'Isso será usado para separar a data/hora arquivada do título.',
  'Archive date/time format': 'Formato de data/hora do arquivo',
  'Kanban Plugin': 'Plugin Kanban',
  'Hide tags in card titles': 'Ocultar ‘tags’ nos títulos dos cartões',
  'When toggled, tags will be hidden card titles. This will prevent tags from being included in the title when creating new notes.':
    'Quando ativada, as ‘tags’ não serão exibidas nos títulos de cartas. Isso impedirá que as ‘tags’ sejam incluídas no título ao criar novas notas.',
  'Hide card display tags': 'Ocultar ‘tags’ de exibição de cartão',
  'When toggled, tags will not be displayed below the card title.':
    'Quando ativada, as ‘tags’ não serão exibidas abaixo do título do cartão.',
  'Linked Page Metadata': "Metadados de páginas 'lincadas'",
  'Display metadata for the first note linked within a card. Specify which metadata keys to display below. An optional label can be provided, and labels can be hidden altogether.':
    "Exibe metadados para a primeira nota 'lincada' em um cartão. Especifique abaixo quais metadados serão exibidos. Um rótulo opcional pode ser fornecido e os rótulos podem ser ocultados completamente.",

  // MetadataSettings.tsx
  'Metadata key': 'Metadado',
  'Display label': 'Descrição personalizada',
  'Hide label': 'Ocultar',
  'Drag to rearrange': 'Arraste para reorganizar',
  Delete: 'Excluir',
  'Add key': 'Adicionar metadado',

  // components/Item/Item.tsx
  'More options': 'Mais opções',
  Cancel: 'Cancelar',

  // components/Item/ItemContent.tsx
  today: 'hoje',
  yesterday: 'ontem',
  tomorrow: 'amanhã',
  'Change date': 'Alterar data',
  'Change time': 'Mudar hora',

  // components/Item/ItemForm.tsx
  'Card title...': 'Título do item...',
  'Add card': 'Adicionar Item',
  'Add a card': 'Adicione um cartão',

  // components/Item/ItemMenu.ts
  'Edit card': 'Editar cartão',
  'New note from card': 'Nova nota do cartão',
  'Archive card': 'Arquivar cartão',
  'Delete card': 'Excluir cartão',
  'Edit date': 'Editar data',
  'Add date': 'Adicionar data',
  'Remove date': 'Remover data',
  'Edit time': 'Editar hora',
  'Add time': 'Adicionar hora',
  'Remove time': 'Remover hora',
  'Duplicate card': 'Duplicate card',

  // components/Lane/LaneForm.tsx
  'Enter list title...': 'Insira o título da lista...',
  'Mark cards in this list as complete':
    'Marcar os itens nesta lista como concluídos',
  'Add list': 'Adicionar lista',
  'Add a list': 'Adicionar uma lista',

  // components/Lane/LaneHeader.tsx
  'Move list': 'Mover lista',
  Close: 'Fechar',

  // components/Lane/LaneMenu.tsx
  'Are you sure you want to delete this list and all its cards?':
    'Tem certeza de que deseja excluir esta lista e todos os seus cartões?',
  'Yes, delete list': 'Sim, excluir esta lista',
  'Are you sure you want to archive this list and all its cards?':
    'Tem certeza de que deseja arquivar esta lista e todos os seus cartões?',
  'Yes, archive list': 'Sim, arquivar esta lista',
  'Are you sure you want to archive all cards in this list?':
    'Tem certeza de que deseja arquivar todos os cartões desta lista?',
  'Yes, archive cards': 'Sim, arquivar cartões',
  'Edit list': 'Editar lista',
  'Archive cards': 'Arquivar cartões',
  'Archive list': 'Arquivar lista',
  'Delete list': 'Excluir lista',
};
