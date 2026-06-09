import { fromMarkdown } from 'mdast-util-from-markdown';
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter';
import { frontmatter } from 'micromark-extension-frontmatter';
import { parseYaml } from 'obsidian';
import { KanbanSettings, settingKeyLookup } from 'src/Settings';
import { StateManager } from 'src/StateManager';
import { getNormalizedPath } from 'src/helpers/renderMarkdown';

import { frontmatterKey, getLinkedPageMetadata } from './common';
import { blockidExtension, blockidFromMarkdown } from './extensions/blockid';
import { genericWrappedExtension, genericWrappedFromMarkdown } from './extensions/genericWrapped';
import { internalMarkdownLinks } from './extensions/internalMarkdownLink';
import { tagExtension, tagFromMarkdown } from './extensions/tag';
import { gfmTaskListItem, gfmTaskListItemFromMarkdown } from './extensions/taskList';
import { FileAccessor } from './helpers/parser';

function extractFrontmatter(md: string) {
  let frontmatterStart = -1;
  let openDashCount = 0;

  for (let i = 0, len = md.length; i < len; i++) {
    if (openDashCount < 3) {
      if (md[i] === '-') {
        openDashCount++;
        continue;
      } else {
        throw new Error('Error parsing frontmatter');
      }
    }

    if (frontmatterStart < 0) frontmatterStart = i;

    if (md[i] === '-' && /[\r\n]/.test(md[i - 1]) && md[i + 1] === '-' && md[i + 2] === '-') {
      return parseYaml(md.slice(frontmatterStart, i - 1).trim());
    }
  }
}

function extractSettingsFooter(md: string) {
  let hasEntered = false;
  let openTickCount = 0;
  let settingsEnd = -1;

  for (let i = md.length - 1; i >= 0; i--) {
    if (!hasEntered && /[`%\n\r]/.test(md[i])) {
      if (md[i] === '`') {
        openTickCount++;

        if (openTickCount === 3) {
          hasEntered = true;
          settingsEnd = i - 1;
        }
      }
      continue;
    } else if (!hasEntered) {
      return {};
    }

    if (md[i] === '`' && md[i - 1] === '`' && md[i - 2] === '`' && /[\r\n]/.test(md[i - 3])) {
      return JSON.parse(md.slice(i + 1, settingsEnd).trim());
    }
  }
}

function getExtensions(stateManager: StateManager) {
  return [
    gfmTaskListItem,
    genericWrappedExtension('date', `${stateManager.getSetting('date-trigger')}{`, '}'),
    genericWrappedExtension('dateLink', `${stateManager.getSetting('date-trigger')}[[`, ']]'),
    genericWrappedExtension('time', `${stateManager.getSetting('time-trigger')}{`, '}'),
    genericWrappedExtension(
      'storyPoints',
      `${stateManager.getSetting('story-points-trigger')}{`,
      '}'
    ),
    genericWrappedExtension(
      'priority',
      `${stateManager.getSetting('priority-trigger')}{`,
      '}'
    ),
    genericWrappedExtension(
      'category',
      `${stateManager.getSetting('category-trigger')}{`,
      '}'
    ),
    genericWrappedExtension('embedWikilink', '![[', ']]'),
    genericWrappedExtension('wikilink', '[[', ']]'),
    tagExtension(),
    blockidExtension(),
  ];
}

function getMdastExtensions(stateManager: StateManager) {
  return [
    gfmTaskListItemFromMarkdown,
    genericWrappedFromMarkdown('date', (text, node) => {
      if (!text) return;
      node.date = text;
    }),
    genericWrappedFromMarkdown('dateLink', (text, node) => {
      if (!text) return;
      node.date = text;
    }),
    genericWrappedFromMarkdown('time', (text, node) => {
      if (!text) return;
      node.time = text;
    }),
    genericWrappedFromMarkdown('storyPoints', (text, node) => {
      if (!text) return;
      node.storyPoints = text;
    }),
    genericWrappedFromMarkdown('priority', (text, node) => {
      if (!text) return;
      node.priority = text;
    }),
    genericWrappedFromMarkdown('category', (text, node) => {
      if (!text) return;
      node.category = text;
    }),
    genericWrappedFromMarkdown('embedWikilink', (text, node) => {
      if (!text) return;

      const normalizedPath = getNormalizedPath(text);

      const file = stateManager.app.metadataCache.getFirstLinkpathDest(
        normalizedPath.root,
        stateManager.file.path
      );

      node.fileAccessor = {
        target: normalizedPath.root,
        isEmbed: true,
        stats: file?.stat,
      } as FileAccessor;
    }),
    genericWrappedFromMarkdown('wikilink', (text, node) => {
      if (!text) return;

      const normalizedPath = getNormalizedPath(text);

      const file = stateManager.app.metadataCache.getFirstLinkpathDest(
        normalizedPath.root,
        stateManager.file.path
      );

      node.fileAccessor = {
        target: normalizedPath.root,
        isEmbed: false,
      } as FileAccessor;

      if (file) {
        const metadata = getLinkedPageMetadata(stateManager, file);

        node.fileMetadata = metadata.fileMetadata;
        node.fileMetadataOrder = metadata.fileMetadataOrder;
      }
    }),
    internalMarkdownLinks((node, isEmbed) => {
      if (!node.url || /:\/\//.test(node.url) || !/.md$/.test(node.url)) {
        return;
      }

      const file = stateManager.app.metadataCache.getFirstLinkpathDest(
        decodeURIComponent(node.url),
        stateManager.file.path
      );

      if (isEmbed) {
        node.type = 'embedLink';
        node.fileAccessor = {
          target: decodeURIComponent(node.url),
          isEmbed: true,
          stats: file.stat,
        } as FileAccessor;
      } else {
        node.fileAccessor = {
          target: decodeURIComponent(node.url),
          isEmbed: false,
        } as FileAccessor;

        if (file) {
          const metadata = getLinkedPageMetadata(stateManager, file);

          node.fileMetadata = metadata.fileMetadata;
          node.fileMetadataOrder = metadata.fileMetadataOrder;
        }
      }
    }),
    tagFromMarkdown(),
    blockidFromMarkdown(),
  ];
}

export function parseMarkdown(stateManager: StateManager, md: string) {
  const mdFrontmatter = extractFrontmatter(md);
  const mdSettings = extractSettingsFooter(md);
  const settings = { ...mdSettings };
  const fileFrontmatter: Record<string, any> = {};

  Object.keys(mdFrontmatter).forEach((key) => {
    if (key === frontmatterKey) {
      const val = mdFrontmatter[key] === 'basic' ? 'board' : mdFrontmatter[key];
      settings[key] = val;
      fileFrontmatter[key] = val;
    } else if (settingKeyLookup.has(key as keyof KanbanSettings)) {
      settings[key] = mdFrontmatter[key];
    } else {
      fileFrontmatter[key] = mdFrontmatter[key];
    }
  });

  stateManager.compileSettings(settings);

  return {
    settings,
    frontmatter: fileFrontmatter,
    ast: fromMarkdown(md, {
      extensions: [frontmatter(['yaml']), ...getExtensions(stateManager)],
      mdastExtensions: [frontmatterFromMarkdown(['yaml']), ...getMdastExtensions(stateManager)],
    }),
  };
}

export function parseFragment(stateManager: StateManager, md: string) {
  return fromMarkdown(md, {
    extensions: getExtensions(stateManager),
    mdastExtensions: getMdastExtensions(stateManager),
  });
}
