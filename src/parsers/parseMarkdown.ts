import { fromMarkdown } from 'mdast-util-from-markdown';
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter';
import { frontmatter } from 'micromark-extension-frontmatter';
import { parseYaml } from 'obsidian';
import { KanbanSettings, settingKeyLookup } from 'src/Settings';
import { StateManager } from 'src/StateManager';
import { getNormalizedPath } from 'src/helpers/renderMarkdown';

import { frontmatterKey, getLinkedPageMetadata, kanbanDataHeadingKey } from './common';
import { blockidExtension, blockidFromMarkdown } from './extensions/blockid';
import { genericWrappedExtension, genericWrappedFromMarkdown } from './extensions/genericWrapped';
import { internalMarkdownLinks } from './extensions/internalMarkdownLink';
import { tagExtension, tagFromMarkdown } from './extensions/tag';
import { gfmTaskListItem, gfmTaskListItemFromMarkdown } from './extensions/taskList';
import { FileAccessor } from './helpers/parser';

export function extractFrontmatter(md: string) {
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

export function extractKanbanDataHeadingData(text: string, kanbanDataHeading?: string) {
  if(!kanbanDataHeading) {
    return { kanbanSectionFound: false, offsetStart: -1, offsetEnd: -1, headerPosition: -1 };
  }

  let kanbanSectionFound = false;
  let offsetStart = -1;
  let offsetEnd = -1;

  const lines = text.split('\n');
  let position = 0;

  const targetHeading = `# ${kanbanDataHeading.toLowerCase()}`;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLength = line.length + 1; // +1 for the newline character

    if (line.trim().toLowerCase() === targetHeading) {
      kanbanSectionFound = true;
      offsetStart = position + lineLength;

      let contentEndOffset = offsetStart;
      let lastNonEmptyOffset = offsetStart;

      for (let j = i + 1; j < lines.length; j++) {
        const contentLine = lines[j];

        if (contentLine.startsWith('# ') || contentLine === '#') {
          // Next depth 1 heading found; stop collecting
          break;
        } else {
          contentEndOffset += contentLine.length + 1; // +1 for newline

          if (contentLine.trim().length > 0) {
            // Update lastNonEmptyOffset to the end of this line
            lastNonEmptyOffset = contentEndOffset;
          }
        }
      }

      offsetEnd = lastNonEmptyOffset - 1; // -1 to exclude the newline character
      break;
    }

    position += lineLength;
  }

  return { kanbanSectionFound, offsetStart, offsetEnd, headerPosition: position };
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
  let operationalMd = md;

  // NOTE: that kanban-data-heading can be set only in frontmatter or globally, but not in mdSettings, 
  // because the location of mdSettings is dependent on kanban-data-heading itself.
  if(mdFrontmatter[kanbanDataHeadingKey]) {
    const { kanbanSectionFound, offsetStart, offsetEnd } = extractKanbanDataHeadingData(md, mdFrontmatter[kanbanDataHeadingKey]);
    if (kanbanSectionFound) {
      operationalMd = md.slice(offsetStart, offsetEnd);
    } else {
      console.warn('Kanban Data Heading not found in document');
    }
  }

  const mdSettings = extractSettingsFooter(operationalMd);
  const settings = { ...mdSettings };
  const fileFrontmatter: Record<string, any> = {};

  Object.keys(mdFrontmatter).forEach((key) => {
    if (key === frontmatterKey || key === kanbanDataHeadingKey) {
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
    ast: fromMarkdown(operationalMd, {
      extensions: [frontmatter(['yaml']), ...getExtensions(stateManager)],
      mdastExtensions: [frontmatterFromMarkdown(['yaml']), ...getMdastExtensions(stateManager)],
    }),
    operationalMd,
  };
}

export function parseFragment(stateManager: StateManager, md: string) {
  return fromMarkdown(md, {
    extensions: getExtensions(stateManager),
    mdastExtensions: getMdastExtensions(stateManager),
  });
}
