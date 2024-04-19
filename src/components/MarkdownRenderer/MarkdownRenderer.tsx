/* eslint-disable @typescript-eslint/ban-ts-comment */
import classcat from 'classcat';
import Mark from 'mark.js';
import moment from 'moment';
import { MarkdownRenderer as ObsidianRenderer, TFile, getLinkpath } from 'obsidian';
import { appHasDailyNotesPluginLoaded, createDailyNote } from 'obsidian-daily-notes-interface';
import { CSSProperties, memo, useEffect, useRef } from 'preact/compat';
import { useCallback, useContext } from 'preact/hooks';
import { KanbanView } from 'src/KanbanView';
import { DndManagerContext, EntityManagerContext } from 'src/dnd/components/context';
import { PromiseCapability } from 'src/helpers/util';
import { frontmatterKey } from 'src/parsers/common';

import {
  applyCheckboxIndexes,
  getNormalizedPath,
  renderMarkdown,
} from '../../helpers/renderMarkdown';
import { usePreprocessedStr } from '../Editor/dateWidget';
import { KanbanContext, SearchContext, SortContext } from '../context';
import { c, noop } from '../helpers';
import { DateColor, TagColor } from '../types';

interface MarkdownRendererProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  markdownString: string;
  searchQuery?: string;
}

interface MarkdownPreviewRendererProps extends MarkdownRendererProps {
  entityId: string;
}

function appendOrReplaceFirstChild(wrapper?: HTMLDivElement, child?: HTMLDivElement) {
  if (!child || !wrapper) return;

  if (wrapper && !wrapper.firstChild) {
    wrapper.appendChild(child);
  } else if (wrapper.firstChild && wrapper.firstChild !== child) {
    wrapper.replaceChild(child, wrapper.firstChild);
  }
}

function preventDragOnLink(e: DragEvent) {
  const targetEl = e.target as HTMLElement;
  if (targetEl.tagName === 'A') {
    e.preventDefault();
  }
}

export const StaticMarkdownRenderer = memo(function StaticMarkdownRenderer({
  className,
  markdownString,
  searchQuery,
  ...divProps
}: MarkdownRendererProps) {
  const search = useContext(SearchContext);
  const { stateManager, view, filePath, getDateColor, getTagColor } = useContext(KanbanContext);
  const wrapperRef = useRef<HTMLDivElement>();
  const contentRef = useRef<HTMLDivElement>();
  const markRef = useRef<Mark>();

  useEffect(() => {
    renderMarkdown(stateManager.getAView(), markdownString)
      .then((el) => {
        contentRef.current = el;
        markRef.current = new Mark(el);
        colorizeDates(el, getDateColor);
        colorizeTags(el, getTagColor);
        if (wrapperRef.current) appendOrReplaceFirstChild(wrapperRef.current, el);
      })
      .catch((e) => {
        stateManager.setError(e);
        console.error(e);
      });
  }, [stateManager, markdownString]);

  useEffect(() => {
    colorizeTags(contentRef.current, getTagColor);
    colorizeDates(contentRef.current, getDateColor);
  }, [getTagColor, getDateColor]);

  useEffect(() => {
    markRef.current?.unmark();

    if (searchQuery && searchQuery.trim()) {
      markRef.current?.mark(searchQuery);
    }
  }, [searchQuery]);

  const onMouseOver = useCallback(
    (e: MouseEvent) => {
      const targetEl = e.target as HTMLElement;

      if (targetEl.tagName !== 'A') return;

      if (targetEl.hasClass('internal-link')) {
        view.app.workspace.trigger('hover-link', {
          event: e,
          source: frontmatterKey,
          hoverParent: view,
          targetEl,
          linktext: targetEl.getAttr('href'),
          sourcePath: view.file.path,
        });
      }
    },
    [view]
  );

  const onClick = useCallback(
    async (e: MouseEvent) => {
      if (e.type === 'auxclick' || e.button === 2) {
        return;
      }

      const targetEl = e.target as HTMLElement;
      const closestAnchor = targetEl.tagName === 'A' ? targetEl : targetEl.closest('a');

      if (!closestAnchor) return;

      if (closestAnchor.hasClass('file-link')) {
        e.preventDefault();
        const href = closestAnchor.getAttribute('href');
        const normalizedPath = getNormalizedPath(href);
        const target =
          typeof href === 'string' &&
          view.app.metadataCache.getFirstLinkpathDest(normalizedPath.root, view.file.path);

        if (!target) return;

        (stateManager.app as any).openWithDefaultApp(target.path);

        return;
      }

      // Open an internal link in a new pane
      if (closestAnchor.hasClass('internal-link')) {
        e.preventDefault();
        const destination = closestAnchor.getAttr('href');
        const inNewLeaf = e.button === 1 || e.ctrlKey || e.metaKey;
        const isUnresolved = closestAnchor.hasClass('is-unresolved');

        if (isUnresolved && appHasDailyNotesPluginLoaded()) {
          const dateFormat = stateManager.getSetting('date-format');
          const parsed = moment(destination, dateFormat, true);

          if (parsed.isValid()) {
            try {
              const dailyNote = await createDailyNote(parsed);
              const leaf = inNewLeaf ? app.workspace.getLeaf(true) : app.workspace.getLeaf(false);

              await leaf.openFile(dailyNote as unknown as TFile, {
                active: true,
              });
            } catch (e) {
              console.error(e);
              stateManager.setError(e);
            }
            return;
          }
        }

        stateManager.app.workspace.openLinkText(destination, filePath, inNewLeaf);
        return;
      }

      // Open a tag search
      if (closestAnchor.hasClass('tag')) {
        e.preventDefault();
        const tag = closestAnchor.getAttr('href');
        const tagAction = stateManager.getSetting('tag-action');

        if (search && tagAction === 'kanban') {
          search.search(tag, true);
          return;
        }

        (stateManager.app as any).internalPlugins
          .getPluginById('global-search')
          .instance.openGlobalSearch(`tag:${tag}`);
        return;
      }

      // Open external link
      if (closestAnchor.hasClass('external-link')) {
        e.preventDefault();
        window.open(closestAnchor.getAttr('href'), '_blank');
      }
    },
    [stateManager, filePath, search]
  );

  const onContextMenu = useCallback(
    (e: MouseEvent) => {
      const internalLinkPath =
        e.targetNode.instanceOf(HTMLAnchorElement) && e.targetNode.hasClass('internal-link')
          ? e.targetNode.dataset.href
          : undefined;

      if (!internalLinkPath) return;

      (stateManager.app.workspace as any).onLinkContextMenu(
        e,
        getLinkpath(internalLinkPath),
        stateManager.file.path
      );
    },
    [stateManager]
  );

  return (
    <div
      className={classcat([c('markdown-preview-wrapper'), className])}
      {...divProps}
      onMouseOver={onMouseOver}
      onClick={onClick}
      onDragStart={preventDragOnLink}
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      onAuxClick={onClick}
      onContextMenu={onContextMenu}
    >
      <div>
        <div
          className={classcat(['markdown-preview-view', c('markdown-preview-view')])}
          ref={(node) => {
            wrapperRef.current = node;
            appendOrReplaceFirstChild(node, contentRef.current);
          }}
        ></div>
      </div>
    </div>
  );
});

function getPreviewElProxy(previewEl: HTMLElement) {
  return new Proxy(previewEl, {
    get(target, prop) {
      if (prop === 'scrollTop' || prop === 'offsetWidth') {
        return 1;
      }
      // @ts-ignore
      const val = target[prop];
      if (val === 'function') return val.bind(target);
      return val;
    },
  });
}

export class MarkdownRenderer extends ObsidianRenderer {
  search: null = null;
  owner: KanbanView;

  onFoldChange() {}
  showSearch() {}
  onScroll() {}

  constructor(owner: KanbanView, el: HTMLElement) {
    // @ts-ignore
    super(owner.app, el, false);
    this.owner = owner;
    const { renderer } = this;

    renderer.sizerEl.addClass('kanban-renderer');
    renderer.previewEl = getPreviewElProxy(renderer.previewEl);
    renderer.measureSection = noop;
    renderer.updateVirtualDisplay = noop;
    renderer.updateShownSections = noop;
    renderer.onResize = noop;

    // @ts-ignore
    renderer.previewEl.toggleClass('rtl', app.vault.getConfig('rightToLeft'));
    renderer.previewEl.toggleClass('show-indentation-guide', false);
    renderer.previewEl.toggleClass('allow-fold-headings', false);
    renderer.previewEl.toggleClass('allow-fold-lists', false);
    renderer.unfoldAllHeadings();
    renderer.unfoldAllLists();
  }

  lastWidth = -1;
  lastHeight = -1;
  lastRefWidth = -1;
  lastRefHeight = -1;

  observer: ResizeObserver;
  onload() {
    super.onload();

    const { containerEl } = this;

    this.observer = new ResizeObserver((entries) => {
      if (!entries.length) return;

      const entry = entries.first().contentBoxSize[0];
      if (entry.blockSize === 0) return;

      if (this.wrapperEl) {
        const rect = this.wrapperEl.getBoundingClientRect();
        if (this.lastRefHeight === -1 || rect.height > 0) {
          this.lastRefHeight = rect.height;
          this.lastRefWidth = rect.width;
        }
      }

      this.lastWidth = entry.inlineSize;
      this.lastHeight = entry.blockSize;
    });

    containerEl.win.setTimeout(() => {
      this.observer.observe(containerEl, { box: 'border-box' });
    });

    containerEl.addEventListener(
      'pointerdown',
      (evt) => {
        const { targetNode } = evt;
        if (targetNode.instanceOf(HTMLElement) && targetNode.hasClass('task-list-item-checkbox')) {
          if (targetNode.dataset.checkboxIndex === undefined) {
            applyCheckboxIndexes(containerEl);
          }
        }
      },
      { capture: true }
    );

    containerEl.addEventListener(
      'click',
      (evt) => {
        const { targetNode } = evt;
        if (targetNode.instanceOf(HTMLElement) && targetNode.hasClass('task-list-item-checkbox')) {
          evt.preventDefault();
          evt.stopPropagation();
        }
      },
      { capture: true }
    );

    containerEl.addEventListener(
      'contextmenu',
      (evt) => {
        const { targetNode } = evt;
        if (targetNode.instanceOf(HTMLElement) && targetNode.hasClass('task-list-item-checkbox')) {
          evt.preventDefault();
          evt.stopPropagation();
        }
      },
      { capture: true }
    );
  }

  unload(): void {
    super.unload();
    this.observer.disconnect();
  }

  get file() {
    return this.owner.file;
  }

  renderer: any;
  set(content: string) {
    this.renderer.set(content);
    this.renderer.onRendered(() => this.showChildren());
  }

  wrapperEl: HTMLElement;
  migrate(el: HTMLElement) {
    const { lastRefHeight, lastRefWidth, containerEl } = this;
    this.wrapperEl = el;
    if (lastRefHeight > 0) {
      el.style.width = `${lastRefWidth}px`;
      el.style.height = `${lastRefHeight}px`;
      el.win.setTimeout(() => {
        el.style.width = '';
        el.style.height = '';
      }, 10);
    }
    if (containerEl.parentElement !== el) {
      el.append(containerEl);
    }
  }

  isVisible: boolean = false;
  showChildren() {
    const { renderer, wrapperEl } = this;
    const { sizerEl, pusherEl, sections } = renderer;

    sizerEl.setChildrenInPlace([pusherEl, ...sections.map((s: any) => s.el)]);

    if (sizerEl.style.minHeight) sizerEl.style.minHeight = '';
    if (wrapperEl.style.minHeight) wrapperEl.style.minHeight = '';
    this.isVisible = true;
  }

  hideChildren() {
    const { renderer, wrapperEl } = this;
    const { sizerEl } = renderer;

    wrapperEl.style.minHeight = this.lastRefHeight + 'px';
    sizerEl.empty();
    this.isVisible = false;
  }
}

function colorizeTags(wrapperEl: HTMLElement, getTagColor: (tag: string) => TagColor) {
  if (!wrapperEl) return;
  const tagEls = wrapperEl.querySelectorAll<HTMLAnchorElement>('a.tag');
  if (!tagEls?.length) return;

  tagEls.forEach((a) => {
    const color = getTagColor(a.getAttr('href'));
    if (!color) return;
    a.setCssProps({
      '--tag-color': color.color,
      '--tag-background': color.backgroundColor,
    });
  });
}

function colorizeDates(wrapperEl: HTMLElement, getDateColor: (date: moment.Moment) => DateColor) {
  if (!wrapperEl) return;
  const dateEls = wrapperEl.querySelectorAll<HTMLElement>('.' + c('date'));
  if (!dateEls?.length) return;
  dateEls.forEach((el) => {
    const dateStr = el.dataset.date;
    if (!dateStr) return;
    const parsed = moment(dateStr);
    if (!parsed.isValid()) return;
    const color = getDateColor(parsed);
    el.toggleClass('has-background', !!color?.backgroundColor);
    if (!color) return;
    el.setCssProps({
      '--date-color': color.color,
      '--date-background-color': color.backgroundColor,
    });
  });
}

export const MarkdownPreviewRenderer = memo(function MarkdownPreviewRenderer({
  entityId,
  className,
  markdownString,
  searchQuery,
  ...divProps
}: MarkdownPreviewRendererProps) {
  const search = useContext(SearchContext);
  const { view, stateManager, getDateColor, getTagColor } = useContext(KanbanContext);
  const markRef = useRef<Mark>();
  const renderer = useRef<MarkdownRenderer>();
  const elRef = useRef<HTMLDivElement>();

  const entityManager = useContext(EntityManagerContext);
  const dndManager = useContext(DndManagerContext);
  const sortContext = useContext(SortContext);
  const processed = usePreprocessedStr(stateManager, markdownString, getDateColor);

  useEffect(() => {
    if (!renderer.current) return;
    entityManager?.scrollParent?.observer?.unobserve(entityManager.measureNode);
    entityManager?.scrollParent?.observer?.observe(entityManager.measureNode);
  }, [sortContext]);

  useEffect(() => {
    const renderCapability = new PromiseCapability();

    const onVisibilityChange = (isVisible: boolean) => {
      const preview = renderer.current;
      if (!preview) return;

      const { dragManager } = dndManager;
      if (dragManager.dragEntityId === entityManager.entityId) return;
      if (dragManager.dragEntityId === entityManager.parent.entityId) return;

      if (preview.isVisible && !isVisible) {
        preview.hideChildren();
      } else if (!preview.isVisible && isVisible) {
        preview.showChildren();
      }
    };

    if (view.previewCache.has(entityId)) {
      const preview = view.previewCache.get(entityId);

      renderer.current = preview;
      preview.migrate(elRef.current);
      markRef.current?.unmark();
      markRef.current = new Mark(elRef.current);

      entityManager?.emitter.on('visibility-change', onVisibilityChange);
      return () => entityManager?.emitter.off('visibility-change', onVisibilityChange);
    }

    view.previewQueue.add(
      async () => {
        if (!(view as any)._loaded || !elRef.current) return;

        const containerEl = elRef.current.createDiv();
        const preview = (renderer.current = view.addChild(new MarkdownRenderer(view, containerEl)));

        containerEl.onNodeInserted(() => {
          preview.renderer.queueRender();
          renderCapability.resolve();
        }, true);
        view.previewCache.set(entityId, preview);

        preview.wrapperEl = elRef.current;
        preview.renderer.onRendered(() => {
          colorizeTags(elRef.current, getTagColor);
          colorizeDates(elRef.current, getDateColor);
          if (entityManager && !entityManager.isVisible) preview.hideChildren();
        });

        markRef.current = new Mark(elRef.current);
        preview.set(processed);

        await renderCapability.promise;
      },
      { priority: entityManager ? 100000 - entityManager.index : 0 }
    );

    entityManager?.emitter.on('visibility-change', onVisibilityChange);

    return () => {
      renderCapability.resolve();
      entityManager?.emitter.off('visibility-change', onVisibilityChange);
    };
  }, [view, entityId, entityManager]);

  useEffect(() => {
    const preview = renderer.current;
    if (!preview || processed === preview.renderer.text) return;
    preview.set(processed);
    preview.renderer.onRendered(() => {
      preview.showChildren();
      colorizeTags(elRef.current, getTagColor);
      colorizeDates(elRef.current, getDateColor);
      if (entityManager && !entityManager.isVisible) preview.hideChildren();
    });
  }, [processed]);

  useEffect(() => {
    colorizeTags(elRef.current, getTagColor);
    colorizeDates(elRef.current, getDateColor);
  }, [getTagColor, getDateColor]);

  useEffect(() => {
    markRef.current?.unmark();
    if (searchQuery && searchQuery.trim()) {
      markRef.current?.mark(searchQuery);
    }
  }, [searchQuery]);

  useEffect(() => {
    const preview = renderer.current;
    if (elRef.current && preview && preview.containerEl.parentElement !== elRef.current) {
      preview.migrate(elRef.current);
    }
  }, []);

  const onClick = useCallback(
    async (e: MouseEvent) => {
      if (e.type === 'auxclick' || e.button === 2) return;

      const targetEl = e.targetNode as HTMLElement;
      const closestAnchor = targetEl.tagName === 'A' ? targetEl : targetEl.closest('a');

      if (!closestAnchor) return;
      if (closestAnchor.hasClass('tag')) {
        const tagAction = stateManager.getSetting('tag-action');
        if (search && tagAction === 'kanban') {
          e.preventDefault();
          e.stopPropagation();
          const tag = closestAnchor.getAttr('href');
          search.search(tag, true);
          return;
        }
      }
    },
    [stateManager, search]
  );

  let styles: CSSProperties | undefined = undefined;
  if (!renderer.current && view.previewCache.has(entityId)) {
    const preview = view.previewCache.get(entityId);
    if (preview.lastRefHeight > 0) {
      styles = {
        width: `${preview.lastRefWidth}px`,
        height: `${preview.lastRefHeight}px`,
      };
    }
  }

  return (
    <div
      style={styles}
      onClickCapture={onClick}
      onDragStart={preventDragOnLink}
      ref={(el) => {
        elRef.current = el;
        const preview = renderer.current;
        if (el && preview && preview.containerEl.parentElement !== el) {
          renderer.current.migrate(el);
        }
      }}
      className={classcat([c('markdown-preview-wrapper'), className])}
      {...divProps}
    />
  );
});

export const MarkdownClonedPreviewRenderer = memo(function MarkdownClonedPreviewRenderer({
  entityId,
  className,
  ...divProps
}: MarkdownPreviewRendererProps) {
  const { view } = useContext(KanbanContext);
  const renderer = useRef<MarkdownRenderer>();
  const elRef = useRef<HTMLDivElement>();
  const preview = view.previewCache.get(entityId);

  let styles: CSSProperties | undefined = undefined;
  if (!renderer.current && preview) {
    if (preview.lastRefHeight > 0) {
      styles = {
        width: `${preview.lastRefWidth}px`,
        height: `${preview.lastRefHeight}px`,
      };
    }
  }

  return (
    <div
      style={styles}
      ref={(el) => {
        elRef.current = el;
        if (el && preview && el.childElementCount === 0) {
          el.append(preview.containerEl.cloneNode(true));
        }
      }}
      className={classcat([c('markdown-preview-wrapper'), className])}
      {...divProps}
    />
  );
});
