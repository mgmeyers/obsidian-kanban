import { CachedMetadata, MarkdownRenderer, TFile } from 'obsidian';

import { KanbanView } from 'src/KanbanView';
import { t } from 'src/lang/helpers';

import { c } from '../helpers';

const imageExt = ['bmp', 'png', 'jpg', 'jpeg', 'gif', 'svg'];
const audioExt = ['mp3', 'wav', 'm4a', '3gp', 'flac', 'ogg', 'oga'];
const videoExt = ['mp4', 'webm', 'ogv'];

const noBreakSpace = /\u00A0/g;
const illigalChars = /[!"#$%&()*+,.:;<=>?@^`{|}~/[\]\\]/g;

function sanitize(e: string) {
  return e.replace(illigalChars, ' ').replace(/\s+/g, ' ').trim();
}

export function getNormalizedPath(path: string) {
  const stripped = path.replace(noBreakSpace, ' ').normalize('NFC');
  const root = stripped.split('#')[0];

  return {
    path: root,
    subpath: stripped.substr(root.length),
  };
}

function getSubpathBoundary(fileCache: CachedMetadata, subpath: string) {
  if (!fileCache || !subpath) return null;

  const pathArr = subpath.split('#').filter((e) => {
    return !!e;
  });

  if (!pathArr || 0 === pathArr.length) return null;

  if (pathArr.length === 1) {
    const firstSegment = pathArr[0];

    if (firstSegment.startsWith('^')) {
      const blockId = firstSegment.substr(1).toLowerCase();
      const blockCache = fileCache.blocks;

      if (blockCache && blockCache[blockId]) {
        const block = blockCache[blockId];

        return {
          type: 'block',
          block,
          start: block.position.start.offset,
          end: block.position.end.offset,
        };
      } else {
        return null;
      }
    }
  }

  const headingCache = fileCache.headings;
  if (!headingCache || 0 === headingCache.length) return null;

  let l = 0,
    p = 0,
    targetHeadingLevel = 0,
    targetHeading = null,
    nextHeading = null;

  for (; p < headingCache.length; p++) {
    const currentHeading = headingCache[p];

    if (targetHeading && currentHeading.level <= targetHeadingLevel) {
      nextHeading = currentHeading;
      break;
    }

    if (
      !targetHeading &&
      currentHeading.level > targetHeadingLevel &&
      sanitize(currentHeading.heading).toLowerCase() ===
        sanitize(pathArr[l]).toLowerCase()
    ) {
      l++;
      targetHeadingLevel = currentHeading.level;
      if (l === pathArr.length) {
        targetHeading = currentHeading;
      }
    }
  }

  return targetHeading
    ? {
        type: 'heading',
        current: targetHeading,
        next: nextHeading,
        start: targetHeading.position.start.offset,
        end: nextHeading ? nextHeading.position.start.offset : null,
      }
    : null;
}

function applyCheckboxIndexes(dom: HTMLDivElement) {
  const checkboxes = dom.querySelectorAll('.task-list-item-checkbox');

  checkboxes.forEach((el, i) => {
    (el as HTMLElement).dataset.checkboxIndex = i.toString();
  });
}

function handleImage(el: HTMLElement, file: TFile, view: KanbanView) {
  el.empty();

  el.createEl(
    'img',
    { attr: { src: view.app.vault.getResourcePath(file) } },
    (img) => {
      if (el.hasAttribute('width')) {
        img.setAttribute('width', el.getAttribute('width'));
      }

      if (el.hasAttribute('height')) {
        img.setAttribute('height', el.getAttribute('height'));
      }

      if (el.hasAttribute('alt')) {
        img.setAttribute('alt', el.getAttribute('alt'));
      }
    }
  );

  el.addClasses(['image-embed', 'is-loaded']);
}

function handleAudio(el: HTMLElement, file: TFile, view: KanbanView) {
  el.empty();
  el.createEl('audio', {
    attr: { controls: '', src: view.app.vault.getResourcePath(file) },
  });
  el.addClasses(['media-embed', 'is-loaded']);
}

function handleVideo(el: HTMLElement, file: TFile, view: KanbanView) {
  el.empty();

  el.createEl(
    'video',
    { attr: { controls: '', src: view.app.vault.getResourcePath(file) } },
    (video) => {
      const handleLoad = () => {
        video.removeEventListener('loadedmetadata', handleLoad);

        if (video.videoWidth === 0 && video.videoHeight === 0) {
          el.empty();
          handleAudio(el, file, view);
        }
      };

      video.addEventListener('loadedmetadata', handleLoad);
    }
  );

  el.addClasses(['media-embed', 'is-loaded']);
}

async function getEmbeddedMarkdownString(
  file: TFile,
  normalizedPath: { path: string; subpath: string },
  view: KanbanView
) {
  const fileCache = view.app.metadataCache.getFileCache(file);

  if (!fileCache) {
    return null;
  }

  const content = await view.app.vault.cachedRead(file);

  if (!normalizedPath.subpath) {
    return content;
  }

  const contentBoundary = getSubpathBoundary(fileCache, normalizedPath.subpath);

  if (contentBoundary) {
    return content.substring(contentBoundary.start, contentBoundary.end);
  } else if (normalizedPath.subpath) {
    return `${t('Unable to find')} ${normalizedPath.path}${
      normalizedPath.subpath
    }`;
  }
}

function pollForCachedSubpath(
  file: TFile,
  normalizedPath: { path: string; subpath: string },
  view: KanbanView,
  remainingCount: number
) {
  setTimeout(async () => {
    if (view.plugin.viewMap.has(view.id)) {
      const string = await getEmbeddedMarkdownString(
        file,
        normalizedPath,
        view
      );

      if (!string) return;

      if (!string.startsWith(t('Unable to find'))) {
        view.plugin.stateManagers.forEach((manager) => {
          manager.onFileMetadataChange(file);
        });
      } else if (remainingCount > 0) {
        pollForCachedSubpath(file, normalizedPath, view, remainingCount--);
      }
    }
  }, 2000);
}

async function handleMarkdown(
  el: HTMLElement,
  file: TFile,
  normalizedPath: { path: string; subpath: string },
  view: KanbanView
) {
  const content = await getEmbeddedMarkdownString(file, normalizedPath, view);

  if (!content) return;

  el.empty();
  const dom = createDiv();

  dom.addClasses(['markdown-preview-view', c('markdown-preview-view')]);

  await MarkdownRenderer.renderMarkdown(
    content,
    dom.createDiv(),
    file.path,
    view
  );

  el.append(dom);
  el.addClass('is-loaded');

  if (content.startsWith(t('Unable to find'))) {
    pollForCachedSubpath(file, normalizedPath, view, 4);
  }
}

function handleEmbeds(dom: HTMLDivElement, view: KanbanView) {
  return Promise.all(
    dom.findAll('.internal-embed').map(async (el) => {
      const src = el.getAttribute('src');
      const normalizedPath = getNormalizedPath(src);
      const target =
        typeof src === 'string' &&
        view.app.metadataCache.getFirstLinkpathDest(
          normalizedPath.path,
          view.file.path
        );

      if (!(target instanceof TFile)) {
        return;
      }

      if (imageExt.contains(target.extension)) {
        return handleImage(el, target, view);
      }

      if (audioExt.contains(target.extension)) {
        return handleAudio(el, target, view);
      }

      if (videoExt.contains(target.extension)) {
        return handleVideo(el, target, view);
      }

      if (target.extension === 'md') {
        return await handleMarkdown(el, target, normalizedPath, view);
      }
    })
  );
}

export async function renderMarkdown(
  view: KanbanView,
  markdownString: string
): Promise<HTMLDivElement> {
  const dom = createDiv();

  await MarkdownRenderer.renderMarkdown(
    markdownString,
    dom,
    view.file.path,
    view
  );

  await handleEmbeds(dom, view);
  applyCheckboxIndexes(dom);

  return dom;
}
