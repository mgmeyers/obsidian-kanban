export const commands: Record<string, (editor: any) => void> = {
  'editor:toggle-bold': (editor: any) => {
    editor.toggleMarkdownFormatting('bold');
  },
  'editor:toggle-code': (editor: any) => {
    editor.toggleMarkdownFormatting('code');
  },
  'editor:toggle-italics': (editor: any) => {
    editor.toggleMarkdownFormatting('italic');
  },
  'editor:toggle-highlight': (editor: any) => {
    editor.toggleMarkdownFormatting('highlight');
  },
  'editor:toggle-strikethrough': (editor: any) => {
    editor.toggleMarkdownFormatting('strikethrough');
  },
  'editor:toggle-inline-math': (editor: any) => {
    editor.toggleMarkdownFormatting('math');
  },
  'editor:toggle-blockquote': (editor: any) => {
    editor.toggleBlockquote();
  },
  'editor:toggle-comments': (editor: any) => {
    editor.toggleComment();
  },
  'editor:toggle-bullet-list': (editor: any) => {
    editor.toggleBulletList();
  },
  'editor:toggle-numbered-list': (editor: any) => {
    editor.toggleNumberList();
  },
  'editor:toggle-checklist-status': (editor: any) => {
    editor.toggleCheckList();
  },
  'editor:cycle-list-checklist': (editor: any) => {
    editor.toggleCheckList(true);
  },
  'editor:insert-callout': (editor: any) => {
    editor.insertCallout();
  },
  'editor:insert-codeblock': (editor: any) => {
    editor.insertCodeblock();
  },
  'editor:insert-horizontal-rule': (editor: any) => {
    editor.insertHorizontalRule();
  },
  'editor:insert-mathblock': (editor: any) => {
    editor.insertMathBlock();
  },
  'editor:indent-list': (editor: any) => {
    editor.indentList();
  },
  'editor:unindent-list': (editor: any) => {
    editor.unindentList();
  },
  'editor:swap-line-up': (editor: any) => {
    editor.exec('swapLineUp');
  },
  'editor:swap-line-down': (editor: any) => {
    editor.exec('swapLineDown');
  },
  'editor:delete-paragraph': (editor: any) => {
    editor.exec('deleteLine');
  },
};
