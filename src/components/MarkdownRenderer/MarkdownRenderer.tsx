/* eslint-disable @typescript-eslint/ban-ts-comment */
import classcat from 'classcat';
import Mark from 'mark.js';
import moment from 'moment';
import { Component, MarkdownRenderer as ObsidianRenderer, getLinkpath } from 'obsidian';
import { CSSProperties, memo, useEffect, useRef } from 'preact/compat';
import { useContext } from 'preact/hooks';
import { KanbanView } from 'src/KanbanView';
import { DndManagerContext, EntityManagerContext } from 'src/dnd/components/context';
import { PromiseCapability } from 'src/helpers/util';

import { applyCheckboxIndexes } from '../../helpers/renderMarkdown';
import { IntersectionObserverContext, KanbanContext, SortContext } from '../context';
import { c, useGetDateColorFn, useGetTagColorFn } from '../helpers';
import { DateColor, TagColor } from '../types';

interface MarkdownRendererProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  markdownString: string;
  searchQuery?: string;
  entityId?: string;
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

export class BasicMarkdownRenderer extends Component {
  containerEl: HTMLElement;
  wrapperEl: HTMLElement;
  renderCapability: PromiseCapability;
  observer: ResizeObserver;
  isVisible: boolean = false;
  mark: Mark;

  lastWidth = -1;
  lastHeight = -1;
  lastRefWidth = -1;
  lastRefHeight = -1;

  constructor(
    public view: KanbanView,
    public markdown: string
  ) {
    super();
    this.containerEl = createDiv(
      'markdown-preview-view markdown-rendered ' + c('markdown-preview-view')
    );
    this.mark = new Mark(this.containerEl);
    this.renderCapability = new PromiseCapability<void>();
  }

  onload() {
    this.render();
  }

  // eslint-disable-next-line react/require-render-return
  async render() {
    this.containerEl.empty();

    await ObsidianRenderer.render(
      this.view.app,
      this.markdown,
      this.containerEl,
      this.view.file.path,
      this
    );

    this.renderCapability.resolve();
    if (!(this.view as any)?._loaded || !(this as any)._loaded) return;

    const { containerEl } = this;

    this.resolveLinks();
    applyCheckboxIndexes(containerEl);

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
      'click',
      (evt) => {
        const { targetNode } = evt;
        if (
          targetNode.instanceOf(HTMLElement) &&
          targetNode.hasClass('task-list-item-checkbox') &&
          !targetNode.closest('.markdown-embed')
        ) {
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

  migrate(el: HTMLElement) {
    const { lastRefHeight, lastRefWidth, containerEl } = this;
    this.wrapperEl = el;
    if (lastRefHeight > 0) {
      el.style.width = `${lastRefWidth}px`;
      el.style.height = `${lastRefHeight}px`;
      el.win.setTimeout(() => {
        el.style.width = '';
        el.style.height = '';
      }, 50);
    }
    if (containerEl.parentElement !== el) {
      el.append(containerEl);
    }

    this.mark.unmark();
  }

  show() {
    const { wrapperEl, containerEl } = this;
    if (!wrapperEl) return;
    wrapperEl.append(containerEl);
    if (wrapperEl.style.minHeight) wrapperEl.style.minHeight = '';
    this.isVisible = true;
  }

  hide() {
    const { containerEl, wrapperEl } = this;
    if (!wrapperEl) return;
    wrapperEl.style.minHeight = this.lastRefHeight + 'px';
    containerEl.detach();
    this.isVisible = false;
  }

  set(markdown: string) {
    if ((this as any)._loaded) {
      this.markdown = markdown;
      this.renderCapability = new PromiseCapability<void>();
      this.unload();
      this.load();
    }
  }

  resolveLinks() {
    const { containerEl, view } = this;
    const internalLinkEls = containerEl.findAll('a.internal-link');
    for (const internalLinkEl of internalLinkEls) {
      const href = this.getInternalLinkHref(internalLinkEl);
      if (!href) continue;

      const path = getLinkpath(href);
      const file = view.app.metadataCache.getFirstLinkpathDest(path, view.file.path);
      internalLinkEl.toggleClass('is-unresolved', !file);
    }
  }

  getInternalLinkHref(el: HTMLElement) {
    const href = el.getAttr('data-href') || el.getAttr('href');
    if (!href) return null;
    return href;
  }
}

export const MarkdownRenderer = memo(function MarkdownPreviewRenderer({
  entityId,
  className,
  markdownString,
  searchQuery,
  ...divProps
}: MarkdownRendererProps) {
  const { view, stateManager } = useContext(KanbanContext);
  const entityManager = useContext(EntityManagerContext);
  const dndManager = useContext(DndManagerContext);
  const sortContext = useContext(SortContext);
  const intersectionContext = useContext(IntersectionObserverContext);
  const getTagColor = useGetTagColorFn(stateManager);
  const getDateColor = useGetDateColorFn(stateManager);

  const renderer = useRef<BasicMarkdownRenderer>();
  const elRef = useRef<HTMLDivElement>();

  // Reset virtualization if this entity is a managed entity and has changed sort order
  useEffect(() => {
    if (!entityManager || !entityId || !renderer.current) return;

    const observer = entityManager?.scrollParent?.observer;
    if (!observer) return;

    observer.unobserve(entityManager.measureNode);
    observer.observe(entityManager.measureNode);
  }, [sortContext]);

  // If we have an intersection context (eg, in table view) then use that for virtualization
  useEffect(() => {
    if (!intersectionContext || !elRef.current) return;

    intersectionContext.registerHandler(elRef.current, (entry) => {
      if (entry.isIntersecting) renderer.current?.show();
      else renderer.current?.hide();
    });

    return () => {
      if (elRef.current) {
        intersectionContext?.unregisterHandler(elRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onVisibilityChange = (isVisible: boolean) => {
      const preview = renderer.current;
      if (!preview || !entityManager?.parent) return;

      const { dragManager } = dndManager;
      if (dragManager.dragEntityId === entityManager.entityId) return;
      if (dragManager.dragEntityId === entityManager.parent.entityId) return;

      if (preview.isVisible && !isVisible) {
        preview.hide();
      } else if (!preview.isVisible && isVisible) {
        preview.show();
      }
    };

    if (entityId && view.previewCache.has(entityId)) {
      const preview = view.previewCache.get(entityId);

      renderer.current = preview;
      preview.migrate(elRef.current);

      entityManager?.emitter.on('visibility-change', onVisibilityChange);
      return () => entityManager?.emitter.off('visibility-change', onVisibilityChange);
    }

    const markdownRenderer = new BasicMarkdownRenderer(view, markdownString);
    markdownRenderer.wrapperEl = elRef.current;

    const preview = (renderer.current = view.addChild(markdownRenderer));
    if (entityId) view.previewCache.set(entityId, preview);

    elRef.current.empty();
    elRef.current.append(preview.containerEl);
    colorizeTags(elRef.current, getTagColor);
    colorizeDates(elRef.current, getDateColor);

    entityManager?.emitter.on('visibility-change', onVisibilityChange);

    return () => {
      renderer.current?.renderCapability.resolve();
      entityManager?.emitter.off('visibility-change', onVisibilityChange);
    };
  }, [view, entityId, entityManager]);

  // Respond to changes to the markdown string
  useEffect(() => {
    const preview = renderer.current;
    if (!preview || markdownString === preview.markdown) return;

    preview.renderCapability.resolve();

    preview.set(markdownString);
    preview.renderCapability.promise.then(() => {
      colorizeTags(elRef.current, getTagColor);
      colorizeDates(elRef.current, getDateColor);
    });
  }, [markdownString]);

  useEffect(() => {
    if (!renderer.current) return;
    colorizeTags(elRef.current, getTagColor);
    colorizeDates(elRef.current, getDateColor);
  }, [getTagColor, getDateColor]);

  useEffect(() => {
    const preview = renderer.current;
    if (!preview) return;
    preview.mark.unmark();
    if (searchQuery && searchQuery.trim()) {
      preview.mark.mark(searchQuery);
    }
  }, [searchQuery]);

  useEffect(() => {
    const preview = renderer.current;
    if (elRef.current && preview && preview.wrapperEl !== elRef.current) {
      preview.migrate(elRef.current);
    }
  }, []);

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
      ref={elRef}
      className={classcat([c('markdown-preview-wrapper'), className])}
      {...divProps}
    />
  );
});

export const MarkdownClonedPreviewRenderer = memo(function MarkdownClonedPreviewRenderer({
  entityId,
  className,
  ...divProps
}: MarkdownRendererProps) {
  const { view } = useContext(KanbanContext);
  const elRef = useRef<HTMLDivElement>();
  const preview = view.previewCache.get(entityId);

  let styles: CSSProperties | undefined = undefined;
  if (preview && preview.lastRefHeight > 0) {
    styles = {
      width: `${preview.lastRefWidth}px`,
      height: `${preview.lastRefHeight}px`,
    };
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
