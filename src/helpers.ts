import { App } from 'obsidian';
import { getDailyNoteSettings } from 'obsidian-daily-notes-interface';

export function buildLinkToDailyNote(app: App, dateStr: string) {
  const dailyNoteSettings = getDailyNoteSettings();
  const shouldUseMarkdownLinks = !!(app.vault as any).getConfig(
    'useMarkdownLinks'
  );

  if (shouldUseMarkdownLinks) {
    return `[${dateStr}](${
      dailyNoteSettings.folder
        ? `${encodeURIComponent(dailyNoteSettings.folder)}/`
        : ''
    }${encodeURIComponent(dateStr)}.md)`;
  }

  return `[[${dateStr}]]`;
}

export function hasFrontmatterKey(data: string) {
  if (!data) return false;

  const match = data.match(/---\s+([\w\W]+?)\s+---/);

  if (!match) {
    return false;
  }

  if (!match[1].contains('kanban-plugin')) {
    return false;
  }

  return true;
}
