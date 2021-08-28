// 简体中文

export default {
  // main.ts
  'Open as kanban board': '打开为看板',
  'Create new board': '创建新看板',
  'Archive completed cards in active board': '在当前看板中归档已完成卡片',
  'Error: current file is not a Kanban board': '错误：当前文件不是看板文件',
  'Convert empty note to Kanban': '转换空白文档为看板',
  'Error: cannot create Kanban, the current note is not empty':
    '错误：无法转换当前文件，当前文件不是空白文档',
  'New kanban board': '新看板',
  'Untitled Kanban': '未命名看板',

  // KanbanView.tsx
  'Open as markdown': '打开为 Markdown 文件',
  'Open board settings': '打开看板设置',
  'Archive completed cards': '归档已完成卡片',

  // parser.ts
  Complete: '完成',
  Archive: '归档',

  // settingHelpers.ts
  'Note: No template plugins are currently enabled.':
    '注意：当前模板插件没有运行',
  default: '默认',
  'Search...': '搜索。。。',

  // Settings.ts
  'These settings will take precedence over the default Kanban board settings.':
    '当前看板设置将会覆盖默认的看板设置',
  'Set the default Kanban board settings. Settings can be overridden on a board-by-board basis.':
    '设置看板的默认设置。设置可以每个看板单独设置。',
  'Note template': '笔记模板',
  'This template will be used when creating new notes from Kanban cards.':
    '创建新看板卡片时会使用该模板',
  'No template': '没有模板',
  'Note folder': '笔记存放位置',
  'Notes created from Kanban cards will be placed in this folder. If blank, they will be placed in the default location for this vault.':
    '从看板卡片创建的笔记会放置到该文件夹中，如果这里为空，在看板创建的笔记会放置到 Obsidian 的默认文件存放位置。',
  'Default folder': '默认文件夹',
  'Lane width': '卡片宽度',
  'Enter a number to set the lane width in pixels.':
    '输入一个数字来设置看板的卡片宽度',
  'Maximum number of archived cards': '单个看板的归档卡片的最大数量',
  "Archived cards can be viewed in markdown mode. This setting will begin removing old cards once the limit is reached. Setting this value to -1 will allow a board's archive to grow infinitely.":
    '已归档的卡片可以在 Markdown 模式下查看。这个设置会导致插件在已归档的卡片数量抵达限制值时开始删除卡片。当前值设置为 -1 的话可以永久保留所有归档卡片。',
  'Display card checkbox': '展示卡片复选框',
  'When toggled, a checkbox will be displayed with each card':
    '当打开这个，复选框会出现在每个卡片上',
  'Reset to default': '还原初始设置',
  'Date & Time': '日期和时间',
  'Date trigger': '日期触发指令',
  'When this is typed, it will trigger the date selector':
    '当在看板卡片中输入这个时，会触发一个日期选择器',
  'Time trigger': '时间触发指令',
  'When this is typed, it will trigger the time selector':
    '当在看板卡片中输入这个时，会触发一个时间选择器',
  'Date format': '日期格式',
  'This format will be used when saving dates in markdown.':
    '这个格式会在日期保存到 Markdown 格式时使用。',
  'For more syntax, refer to': '更多格式，请查看',
  'format reference': '格式参考',
  'Your current syntax looks like this': '你当前设置的格式会是',
  'Time format': '时间格式',
  'Date display format': '日期展示格式',
  'This format will be used when displaying dates in Kanban cards.':
    '在看板卡片中，会基于该格式展示日期',
  'Show relative date': '展示相对日期',
  "When toggled, cards will display the distance between today and the card's date. eg. 'In 3 days', 'A month ago'":
    '当打开这个，卡片会展示其设置的日期与今天的日期的差值，例如三天内、一个月内等。',
  'Hide card display dates': '隐藏卡片日期',
  'When toggled, formatted dates will not be displayed on the card. Relative dates will still be displayed if they are enabled.':
    '当打开这个，格式化的日期不会展示，但是如果你开启了相对日期的功能，相对日期还是会继续展示。',
  'Hide dates in card titles': '在卡片标题中隐藏日期',
  'When toggled, dates will be hidden card titles. This will prevent dates from being included in the title when creating new notes.':
    '当打开这个，卡片标题中的日期会隐藏，当基于卡片创建新笔记的时候可以避免日期混杂其中。',
  'Link dates to daily notes': '链接日期到日记',
  'When toggled, dates will link to daily notes. Eg. [[2021-04-26]]':
    '当打开这个，日期会自动链接到日记页面，例如 [[2021-04-26]]',
  'Add date and time to archived cards': '添加日期和时间到归档卡片',
  'When toggled, the current date and time will be added to the beginning of a card when it is archived. Eg. - [ ] 2021-05-14 10:00am My card title':
    '当打开这个，当前的日期和时间会被添加到归档的卡片的前端上，例如“- [ ] 2021-05-14 10:00am 我的卡片标题”',
  'Archive date/time separator': '日期或时间分隔符',
  'This will be used to separate the archived date/time from the title':
    '用于从分隔归档卡片的日期或时间',
  'Archive date/time format': '归档日期或时间格式',
  'Kanban Plugin': '看板插件',
  'Hide tags in card titles': '隐藏卡片标题中的标签',
  'When toggled, tags will be hidden card titles. This will prevent tags from being included in the title when creating new notes.':
    '当打开这个，卡片标题中的标签将会被隐藏，来避免生成卡片笔记的时候附带上标签',
  'Hide card display tags': '隐藏卡片上的标签',
  'When toggled, tags will not be displayed below the card title.':
    '当打开这个，卡片标题下方的标签将不会展示',
  'Linked Page Metadata': '连接的页面元数据',
  'Display metadata for the first note linked within a card. Specify which metadata keys to display below. An optional label can be provided, and labels can be hidden altogether.':
    '展示卡片中第一个连接所对应的笔记元数据，请在下方指定哪些元数据可以展示。你可以选择展示标志，标志可以都被隐藏。',

  // MetadataSettings.tsx
  'Metadata key': '元数据参数名',
  'Display label': '展示标志',
  'Hide label': '隐藏标志',
  'Drag to rearrange': '拖动来重排顺序',
  Delete: '删除',
  'Add key': '添加参数名',

  // components/Item/Item.tsx
  'Archive item': '归档卡片',
  'More options': '更多选项',
  Cancel: '取消',

  // components/Item/ItemContent.tsx
  today: '今天',
  yesterday: '昨天',
  tomorrow: '明天',
  'Change date': '更改日期',
  'Change time': '更改时间',

  // components/Item/ItemForm.tsx
  'Item title...': '卡片标题',
  'Add item': '添加',
  'Add a card': '添加卡片',

  // components/Item/ItemMenu.ts
  'Edit card': '编辑卡片',
  'New note from card': '从卡片新建笔记',
  'Archive card': '归档卡片',
  'Delete card': '删除卡片',
  'Edit date': '编辑日期',
  'Add date': '添加日期',
  'Remove date': '移除日期',
  'Edit time': '编辑时间',
  'Add time': '添加时间',
  'Remove time': '移除时间',
  'Duplicate card': '复制卡片',

  // components/Lane/LaneForm.tsx
  'Enter list title...': '输入新的列标题',
  'Mark items in this list as complete': '将该列设置为完成列',
  'Add list': '添加',
  'Add a list': '添加列',

  // components/Lane/LaneHeader.tsx
  'Move list': '移动列',
  Close: '关闭',

  // components/Lane/LaneMenu.tsx
  'Are you sure you want to delete this list and all its cards?':
    '你确定你要删除整列以及该列下所有卡片吗？',
  'Yes, delete list': '是，删除列',
  'Are you sure you want to archive this list and all its cards?':
    '你确定你要归档整列以及该列下所有卡片吗？',
  'Yes, archive list': '是, 归档列',
  'Are you sure you want to archive all cards in this list?':
    '你确认你要归档当前列的所有卡片吗？',
  'Yes, archive cards': '是，归档所有卡片',
  'Edit list': '编辑列',
  'Archive cards': '归档卡片',
  'Archive list': '归档列',
  'Delete list': '删除列',
};
