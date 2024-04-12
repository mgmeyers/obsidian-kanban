/* eslint-disable @typescript-eslint/ban-ts-comment */
import classcat from 'classcat';
import Mark from 'mark.js';
import { MarkdownRenderer as ObsidianRenderer, TFile } from 'obsidian';
import PQueue from 'p-queue';
import { memo, useEffect, useRef } from 'preact/compat';
import { useContext, useState } from 'preact/hooks';
import { KanbanView } from 'src/KanbanView';

import {
  applyCheckboxIndexes,
  renderMarkdown,
} from '../helpers/renderMarkdown';
import { KanbanContext } from './context';
import { c } from './helpers';

interface MarkdownRendererProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  markdownString: string;
  searchQuery?: string;
  priority?: number;
}

function appendOrReplaceFirstChild(
  wrapper?: HTMLDivElement,
  child?: HTMLDivElement
) {
  if (!child || !wrapper) return;

  if (wrapper && !wrapper.firstChild) {
    wrapper.appendChild(child);
  } else if (wrapper.firstChild && wrapper.firstChild !== child) {
    wrapper.replaceChild(child, wrapper.firstChild);
  }
}

export const StaticMarkdownRenderer = memo(function StaticMarkdownRenderer({
  className,
  markdownString,
  searchQuery,
  ...divProps
}: MarkdownRendererProps) {
  const { stateManager } = useContext(KanbanContext);
  const wrapperRef = useRef<HTMLDivElement>();
  const contentRef = useRef<HTMLDivElement>();
  const markRef = useRef<Mark>();

  useEffect(() => {
    renderMarkdown(stateManager.getAView(), markdownString)
      .then((el) => {
        contentRef.current = el;
        markRef.current = new Mark(el);

        if (wrapperRef.current) {
          appendOrReplaceFirstChild(wrapperRef.current, el);
        }
      })
      .catch((e) => {
        stateManager.setError(e);
        console.error(e);
      });
  }, [stateManager, markdownString]);

  useEffect(() => {
    markRef.current?.unmark();

    if (searchQuery && searchQuery.trim()) {
      markRef.current?.mark(searchQuery);
    }
  }, [searchQuery]);

  return (
    <div
      ref={(node) => {
        wrapperRef.current = node;
        appendOrReplaceFirstChild(node, contentRef.current);
      }}
      className={classcat([
        'markdown-preview-view',
        c('markdown-preview-view'),
        className,
      ])}
      {...divProps}
    />
  );
});

class MarkdownRenderer extends ObsidianRenderer {
  search: null = null;
  owner: KanbanView;

  onFoldChange() {}
  showSearch() {}
  onScroll() {}

  constructor(
    owner: KanbanView,
    el: HTMLElement | DocumentFragment,
    renderOnInsert: boolean = true
  ) {
    // @ts-ignore
    super(owner.app, el, renderOnInsert);
    this.owner = owner;
    this.containerEl.addEventListener(
      'pointerdown',
      (evt) => {
        const { targetNode } = evt;
        if (
          targetNode.instanceOf(HTMLElement) &&
          targetNode.hasClass('task-list-item-checkbox')
        ) {
          if (targetNode.dataset.checkboxIndex === undefined) {
            applyCheckboxIndexes(this.containerEl);
          }
        }
      },
      { capture: true }
    );
    this.containerEl.addEventListener(
      'click',
      (evt) => {
        const { targetNode } = evt;
        if (
          targetNode.instanceOf(HTMLElement) &&
          targetNode.hasClass('task-list-item-checkbox')
        ) {
          evt.preventDefault();
          evt.stopPropagation();
        }
      },
      { capture: true }
    );
    this.containerEl.addEventListener(
      'contextmenu',
      (evt) => {
        const { targetNode } = evt;
        if (
          targetNode.instanceOf(HTMLElement) &&
          targetNode.hasClass('task-list-item-checkbox')
        ) {
          evt.preventDefault();
          evt.stopPropagation();
        }
      },
      { capture: true }
    );
  }

  get file(): TFile | null {
    return this.owner.file;
  }

  renderer: any;

  set(content: string): void {
    const { app, renderer } = this;

    renderer.set(content);
    // @ts-ignore
    renderer.previewEl.toggleClass('rtl', app.vault.getConfig('rightToLeft'));
    renderer.previewEl.toggleClass('show-indentation-guide', false);
    renderer.previewEl.toggleClass('allow-fold-headings', false);
    renderer.previewEl.toggleClass('allow-fold-lists', false);
    renderer.unfoldAllHeadings();
    renderer.unfoldAllLists();
  }

  edit(newContent: string) {
    this.renderer.set(newContent);
  }
}

const q = new PQueue({ concurrency: 50 });

export const MarkdownPreviewRenderer = memo(function MarkdownPreviewRenderer({
  className,
  markdownString,
  searchQuery,
  priority,
  ...divProps
}: MarkdownRendererProps) {
  const { view } = useContext(KanbanContext);
  const markRef = useRef<Mark>();
  const renderer = useRef<MarkdownRenderer>();
  const elRef = useRef<HTMLDivElement>();
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    q.add(
      async () => {
        renderer.current = view.addChild(
          new MarkdownRenderer(view, elRef.current)
        );
        setRendered(true);
        await new Promise((res) => setTimeout(res));
      },
      { priority: priority ?? 0 }
    );
    return () => {
      if (!renderer.current) return;
      view.removeChild(renderer.current);
    };
  }, [view]);

  useEffect(() => {
    if (!rendered) return;
    renderer.current.set(markdownString);
  }, [rendered, markdownString]);

  // TODO
  useEffect(() => {
    markRef.current?.unmark();
    if (searchQuery && searchQuery.trim()) {
      markRef.current?.mark(searchQuery);
    }
  }, [searchQuery]);

  return (
    <div
      ref={elRef}
      className={classcat([c('markdown-preview-wrapper'), className])}
      {...divProps}
    />
  );
});
