import { MarkdownRenderer, TFile } from 'obsidian';

import { KanbanView } from 'src/KanbanView';

export function renderMarkdown(
  view: KanbanView,
  markdownString: string
): HTMLDivElement {
  const tempEl = createDiv();

  MarkdownRenderer.renderMarkdown(markdownString, tempEl, view.file.path, view);

  tempEl.findAll('.internal-embed').forEach((el) => {
    const src = el.getAttribute('src');
    const target =
      typeof src === 'string' &&
      view.app.metadataCache.getFirstLinkpathDest(src, view.file.path);

    if (target instanceof TFile && target.extension !== 'md') {
      el.innerText = '';
      el.createEl(
        'img',
        { attr: { src: view.app.vault.getResourcePath(target) } },
        (img) => {
          if (el.hasAttribute('width')) {
            img.setAttribute('width', el.getAttribute('width'));
          }

          if (el.hasAttribute('alt')) {
            img.setAttribute('alt', el.getAttribute('alt'));
          }
        }
      );

      el.addClasses(['image-embed', 'is-loaded']);
    }
  });

  return tempEl;
}
