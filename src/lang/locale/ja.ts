// 日本語
import { Lang } from './en';

const lang: Partial<Lang> = {
  // main.ts
  'Open as kanban board': 'カンバンボードとして開く',
  'Create new board': 'カンバンボードを新規作成',
  'Archive completed cards in active board': 'アクティブボードの完了したカードをアーカイブ',
  'Error: current file is not a Kanban board':
    'エラー: 現在のファイルはカンバンボードではありません',
  'Convert empty note to Kanban': '空のノートをカンバンに変換',
  'Error: cannot create Kanban, the current note is not empty':
    'エラー: 現在開いているノートは空であり、カンバンを作成できません',
  'New kanban board': '新規カンバンボード',
  'Untitled Kanban': '無題のカンバン',
  'Toggle between Kanban and markdown mode': 'カンバンとマークダウンのモードを切り替える',

  // KanbanView.tsx
  'Open as markdown': 'マークダウンとして開く',
  'Open board settings': 'ボード設定を開く',
  'Archive completed cards': '完了したカードをアーカイブ',
  'Something went wrong': 'エラーが発生しました',
  'You may wish to open as markdown and inspect or edit the file.':
    'マークダウンとしてファイルを開いて調査するか編集することをおすすめします。',
  'Are you sure you want to archive all completed cards on this board?':
    'このボードに含まれるすべての完了したカードをアーカイブしますか？',

  // parser.ts
  Complete: '完了',
  Archive: 'アーカイブ',
  'Invalid Kanban file: problems parsing frontmatter':
    '無効なカンバンファイル: フロントマターのパースに問題があります',
  "I don't know how to interpret this line:": 'この行をどう解釈すればよいか分かりません',
  Untitled: '無題', // auto-created column

  // settingHelpers.ts
  'Note: No template plugins are currently enabled.':
    'ノート:  現在、テンプレートのプラグインが無効化されています',
  default: 'デフォルト',
  'Search...': '検索…',

  // Settings.ts
  'New line trigger': '改行トリガー',
  'Shift + Enter': 'Shift + Enter',
  Enter: 'Enter',
  'Prepend / append new cards': '先頭または末尾に新規カードを追加する',
  'This setting controls whether new cards are added to the beginning or end of the list.':
    'この設定によって新規カードをリストの先頭または末尾に追加するかを決めます。',
  Prepend: '先頭に追加',
  'Prepend (compact)': '先頭に追加(コンパクト)',
  Append: '末尾に追加',
  'These settings will take precedence over the default Kanban board settings.':
    'これらの設定はデフォルトのカンバン設定より優先されます。',
  'Set the default Kanban board settings. Settings can be overridden on a board-by-board basis.':
    'デフォルトのカンバンボード設定をセットします。この設定はボード毎に上書きできます。',
  'Note template': 'ノートテンプレート',
  'This template will be used when creating new notes from Kanban cards.':
    'このテンプレートはカンバンカードからノートを新規作成した際に使用されます。',
  'No template': 'テンプレートがありません',
  'Note folder': 'ノートフォルダ',
  'Notes created from Kanban cards will be placed in this folder. If blank, they will be placed in the default location for this vault.':
    'カンバンカードから作成されたノートはこのフォルダ内に置かれます。ブランクの場合には、この保管庫のデフォルトロケーションに置かれます。',
  'Default folder': 'デフォルトフォルダ',
  'Maximum number of archived cards': 'アーカイブされたカードの最大数',
  "Archived cards can be viewed in markdown mode. This setting will begin removing old cards once the limit is reached. Setting this value to -1 will allow a board's archive to grow infinitely.":
    'アーカイブされたカードはマークダウンモードで閲覧できます。この設定により指定されたアーカイブの限界数まで達した際には古いカードを削除します。この値を-1に設定するとボードのアーカイブ限界を無限にします。',
  'Display card checkbox': 'カードのチェックボックスを表示',
  'When toggled, a checkbox will be displayed with each card':
    '有効化すると各カードのチェックボックスが表示されます。',
  'Reset to default': 'デフォルトにリセット',
  'Date & Time': '日付と時間',
  'Date trigger': '日付トリガー',
  'When this is typed, it will trigger the date selector':
    'この設定に入力された文字列で日付セレクターをトリガーします。',
  'Time trigger': '時間トリガー',
  'When this is typed, it will trigger the time selector':
    'この設定に入力された文字列で時間セレクターをトリガーします。',
  'Date format': '日付フォーマット',
  'This format will be used when saving dates in markdown.':
    'このフォーマットはマークダウンで日付が保存される際に使用されます。',
  'For more syntax, refer to': 'シンタックスについてはこちらを参照:',
  'format reference': 'フォーマットリファレンス',
  'Your current syntax looks like this': '現在のシンタックスは次のように見えます',
  'Time format': '時間フォーマット',
  'Date display format': '日付表示フォーマット',
  'This format will be used when displaying dates in Kanban cards.':
    'このフォーマットはカンバンカード内にて日付の表示に使用されます。',
  'Show relative date': '相対日付を表示',
  'Link dates to daily notes': 'デイリーノートに日付をリンク',
  'When toggled, dates will link to daily notes. Eg. [[2021-04-26]]':
    '有効化すると日付がデイリーノートにリンクされます。 例: [[2021-04-26]]',
  'Add date and time to archived cards': 'アーカイブされたカードに日付と時間を追加',
  'When toggled, the current date and time will be added to the card title when it is archived. Eg. - [ ] 2021-05-14 10:00am My card title':
    '有効化するとカードがアーカイブされた際に現在の日付と時間がカードの最初に追記されるようになります。例: - [ ] 2021-05-14 10:00am カードタイトル',
  'Archive date/time separator': '日付・時間セパレーターをアーカイブ',
  'This will be used to separate the archived date/time from the title':
    'これはアーカイブされた日付・時間をタイトルから分離するのに使用されます。',
  'Archive date/time format': '日付・時間フォーマットをアーカイブ',
  'Kanban Plugin': 'カンバンプラグイン',
  'Linked Page Metadata': 'リンクされたページのメタデータ',
  'Display metadata for the first note linked within a card. Specify which metadata keys to display below. An optional label can be provided, and labels can be hidden altogether.':
    'カード内でリンクされている最初のノートのメタデータを表示します。下に表示するメタデータのキーを指定してください。オプションとしてラベルの付与が可能であり、ラベルは完全に非表示にすることができます。',
  'Board Header Buttons': 'ボードのヘッダーボタン',
  'Calendar: first day of week': 'カレンダー: 週の始まり',
  'Override which day is used as the start of the week':
    '週の始まりとして使用する曜日を変更します。',
  Sunday: '日曜日',
  Monday: '月曜日',
  Tuesday: '火曜日',
  Wednesday: '水曜日',
  Thursday: '木曜日',
  Friday: '金曜日',
  Saturday: '土曜日',

  // MetadataSettings.tsx
  'Metadata key': 'メタデータのキー',
  'Display label': 'ラベルを表示',
  'Hide label': 'ラベルを隠す',
  'Drag to rearrange': 'ドラッグして並べ替える',
  Delete: '削除',
  'Add key': 'キーを追加',
  'Field contains markdown': 'フィールドにマークダウンを含みます',

  // components/Item/Item.tsx
  'More options': '他のオプション',
  Cancel: 'キャンセル',

  // components/Item/ItemContent.tsx
  today: '今日',
  yesterday: '昨日',
  tomorrow: '明日',
  'Change date': '日付を変更',
  'Change time': '時間を変更',

  // components/Item/ItemForm.tsx
  'Card title...': 'カードタイトル…',
  'Add card': 'カードを追加',
  'Add a card': 'カードを追加',

  // components/Item/ItemMenu.ts
  'Edit card': 'カードを編集',
  'New note from card': 'カードからノートを新規作成',
  'Archive card': 'カードをアーカイブ',
  'Delete card': 'カードを削除',
  'Edit date': '日付を編集',
  'Add date': '日付を追加',
  'Remove date': '日付を削除',
  'Edit time': '時間を編集',
  'Add time': '時間を追加',
  'Remove time': '時間を削除',
  'Duplicate card': 'カードを複製',
  'Split card': 'カードを分割',
  'Copy link to card': 'カードへのリンクをコピー',

  // components/Lane/LaneForm.tsx
  'Enter list title...': 'リストタイトルを編集…',
  'Mark cards in this list as complete': 'このリストに含まれるカードを完了としてマークする',
  'Add list': 'リストを追加',
  'Add a list': 'リストを追加',

  // components/Lane/LaneHeader.tsx
  'Move list': 'リストを移動',
  Close: '閉じる',

  // components/Lane/LaneMenu.tsx
  'Are you sure you want to delete this list and all its cards?':
    'このリストと含まれるすべてのカードを削除しますか？',
  'Yes, delete list': 'はい、リストを削除します',
  'Are you sure you want to archive this list and all its cards?':
    'このリストと含まれるすべてのカードをアーカイブしますか？',
  'Yes, archive list': 'はい、リストをアーカイブします',
  'Are you sure you want to archive all cards in this list?':
    'このリストに含まれるすべてのカードをアーカイブしますか？',
  'Yes, archive cards': 'はい、カードをアーカイブします',
  'Edit list': 'リストを編集',
  'Archive cards': 'カードをアーカイブ',
  'Archive list': 'リストをアーカイブ',
  'Delete list': 'リストを削除',

  // components/helpers/renderMarkdown.ts
  'Unable to find': '見つかりません',
  'Open in default app': 'デフォルトアプリで開く',
};

export default lang;
