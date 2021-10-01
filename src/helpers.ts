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
    }${dateStr}.md)`;
  }

  return `[[${dateStr}]]`;
}
