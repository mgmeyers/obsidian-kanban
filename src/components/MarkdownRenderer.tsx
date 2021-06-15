import React from "react";
import Mark from "mark.js";
import { ObsidianContext } from "./context";
import { findDOMNode } from "react-dom";

interface MarkdownRendererProps {
  className?: string;
  markdownString?: string;
  dom?: HTMLDivElement;
  searchQuery?: string;
}

interface MarkdownRendererState {
  parsedEl?: HTMLDivElement
  marker?: Mark;
}

export class MarkdownRenderer extends React.Component<MarkdownRendererProps, MarkdownRendererState> {
  static contextType = ObsidianContext;
  props: MarkdownRendererProps;

  constructor(props: MarkdownRendererProps) {
    super(props);
    // Always maintain state
    this.state = this.refreshState(props);
  }

  parse(props: MarkdownRendererProps) {
    return props.dom.cloneNode(true) || this.context.renderMarkdown(this.props.markdownString);
  }

  refreshState(props: MarkdownRendererProps, state: MarkdownRendererState={}) {
    let {parsedEl, marker} = state;
    if (!parsedEl) parsedEl = this.parse(props);
    if (!marker) {
      marker = new Mark(parsedEl)
    } else {
      marker.unmark();
    }
    if (props.searchQuery) marker.mark(props.searchQuery);
    return (parsedEl !== state.parsedEl || marker !== state.marker ) ? {parsedEl, marker} : state;
  }

  shouldComponentUpdate(nextProps: MarkdownRendererProps, nextState: MarkdownRendererState) {
    // Ignore changes to state, as we only set state from componentDidUpdate
    const res= (
      nextProps.dom !== this.props.dom ||
      nextProps.className !== this.props.className ||
      nextProps.markdownString !== this.props.markdownString ||
      nextProps.searchQuery !== this.props.searchQuery
    );
    return res
  }

  componentDidMount() {
    findDOMNode(this).appendChild(this.state.parsedEl)
  }

  componentDidUpdate(prevProps: MarkdownRendererProps) {
    let {parsedEl, marker} = this.state
    if (this.props.dom !== prevProps.dom || this.props.markdownString !== prevProps.markdownString) {
      const newState = {parsedEl, marker} = this.refreshState(this.props, {});
      this.setState(newState)
    } else if (this.props.searchQuery !== prevProps.searchQuery) {
      marker.unmark();
      if (this.props.searchQuery) marker.mark(this.props.searchQuery)
    }
    const me = findDOMNode(this), newDOM = parsedEl;
    if (me.firstChild) me.replaceChild(newDOM, me.firstChild); else me.appendChild(newDOM);
  }

  render() {
    return (
      <div
        className={`markdown-preview-view ${this.props.className || ""}`}
      />
    );
  }
}
