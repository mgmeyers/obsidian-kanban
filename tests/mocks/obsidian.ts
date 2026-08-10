/**
 * Minimal stand-in for the `obsidian` module, which ships types only and has no
 * runtime outside the app. Vitest aliases `obsidian` here (see vitest.config.ts).
 *
 * Only the surface the parser and board helpers actually touch is implemented;
 * everything else is a stub that exists so imports resolve.
 */
import realMoment from 'moment';

export const moment = realMoment;

export class TFile {
  path: string;
  name: string;
  basename: string;
  extension: string;
  parent: any = null;
  vault: any = null;
  stat = { ctime: 0, mtime: 0, size: 0 };

  constructor(path = 'Board.md') {
    this.path = path;
    this.name = path.split('/').pop();
    this.basename = this.name.replace(/\.[^.]+$/, '');
    this.extension = this.name.split('.').pop();
  }
}

export class TFolder {
  path = '';
  children: any[] = [];
}

/**
 * Flat `key: value` YAML, which is all a Kanban board's frontmatter needs.
 * Values are coerced the way js-yaml would for booleans and numbers.
 */
export function parseYaml(str: string): any {
  const result: Record<string, any> = {};

  for (const rawLine of (str || '').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const sep = line.indexOf(':');
    if (sep === -1) continue;

    const key = line.slice(0, sep).trim();
    const value = line.slice(sep + 1).trim();

    if (value === 'true' || value === 'false') result[key] = value === 'true';
    else if (value !== '' && !isNaN(Number(value))) result[key] = Number(value);
    else result[key] = value.replace(/^["']|["']$/g, '');
  }

  return result;
}

export function stringifyYaml(obj: any): string {
  if (!obj) return '';

  return (
    Object.keys(obj)
      .map((k) => `${k}: ${obj[k]}`)
      .join('\n') + '\n'
  );
}

export function htmlToMarkdown(html: string) {
  return html;
}

export function getLinkpath(link: string) {
  return link.split('#')[0].split('|')[0];
}

export function parseLinktext(link: string) {
  const [path, subpath] = link.split('#');
  return { path, subpath: subpath ? `#${subpath}` : '' };
}

export function debounce<T extends (...args: any[]) => any>(fn: T) {
  return fn;
}

export function setIcon() {}

export const Platform = { isMobile: false, isDesktop: true };

class Stub {
  constructor(..._args: any[]) {}
}

export class App extends Stub {}
export class Component extends Stub {}
export class Editor extends Stub {}
export class EditorSuggest extends Stub {}
export class HoverPopover extends Stub {}
export class Keymap extends Stub {}
export class MarkdownRenderer extends Stub {}
export class MarkdownView extends Stub {}
export class Menu extends Stub {}
export class Modal extends Stub {}
export class Notice extends Stub {}
export class Plugin extends Stub {}
export class PluginSettingTab extends Stub {}
export class Setting extends Stub {}
export class TextFileView extends Stub {}
export class ToggleComponent extends Stub {}
export class DropdownComponent extends Stub {}
export class Vault extends Stub {}
export class WorkspaceLeaf extends Stub {}
