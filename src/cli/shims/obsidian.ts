// Stub signatures mirror the real API, so parameters are named but unused.

/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Stand-in for the `obsidian` module. The parser layer imports only YAML
 * helpers, moment, and a few names it uses purely as types or base classes;
 * everything else here exists so that transitively imported plugin modules
 * still evaluate outside Obsidian.
 */
import { dump, load } from 'js-yaml';
import momentImpl from 'moment';

export const moment = momentImpl;

export function parseYaml(yaml: string): any {
  return load(yaml);
}

export function stringifyYaml(obj: any): string {
  return dump(obj, { lineWidth: -1 });
}

export class TFile {
  path: string;
  name: string;
  basename: string;
  extension: string;
  stat: Stat;
  parent: TFolder | null = null;
  vault: Vault;
}

export class TFolder {
  path: string;
  name: string;
  children: Array<TFile | TFolder> = [];
  parent: TFolder | null = null;
  vault: Vault;
}

export interface Stat {
  ctime: number;
  mtime: number;
  size: number;
}

export class Vault {
  static recurseChildren(_root: TFolder, _cb: (file: TFile | TFolder) => void) {}
}

export class App {}

/**
 * UI classes. Plugin modules extend or instantiate these at import time, so
 * they must be constructible; none of them are ever rendered by the CLI.
 */
class UIStub {
  constructor(..._args: any[]) {}
}

const uiStub: any = new Proxy(UIStub, {
  get(target, prop, receiver) {
    if (prop in target) return Reflect.get(target, prop, receiver);
    return () => uiStub;
  },
});

export const Component = uiStub;
export const Events = uiStub;
export const ItemView = uiStub;
export const MarkdownRenderer = uiStub;
export const MarkdownView = uiStub;
export const Menu = uiStub;
export const Modal = uiStub;
export const Notice = uiStub;
export const Plugin = uiStub;
export const PluginSettingTab = uiStub;
export const Scope = uiStub;
export const Setting = uiStub;
export const DropdownComponent = uiStub;
export const ToggleComponent = uiStub;
export const TextComponent = uiStub;
export const ButtonComponent = uiStub;
export const TextAreaComponent = uiStub;
export const SuggestModal = uiStub;
export const FuzzySuggestModal = uiStub;
export const WorkspaceLeaf = uiStub;

export const Keymap = {
  isModEvent: () => false,
  isModifier: () => false,
};

export const Platform = {
  isDesktop: true,
  isMobile: false,
  isDesktopApp: false,
  isMobileApp: false,
};

export function debounce<T extends (...args: any[]) => any>(fn: T): T {
  return fn;
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

export function setIcon(_el: any, _icon: string) {}

export function htmlToMarkdown(html: string): string {
  return html;
}

export function parseLinktext(linktext: string) {
  const [path, subpath] = linktext.split('#');
  return { path, subpath: subpath ? `#${subpath}` : '' };
}

export function requireApiVersion(_version: string): boolean {
  return true;
}
