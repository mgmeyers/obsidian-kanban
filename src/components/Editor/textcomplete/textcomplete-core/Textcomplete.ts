import { EventEmitter } from "eventemitter3"

import { DropdownOption, Dropdown } from "./Dropdown"
import { Editor } from "./Editor"
import { Completer } from "./Completer"
import { SearchResult } from "./SearchResult"
import { StrategyProps } from "./Strategy"

export interface TextcompleteOption {
  dropdown?: DropdownOption
}

const PASSTHOUGH_EVENT_NAMES = [
  "show",
  "shown",
  "render",
  "rendered",
  "selected",
  "hidden",
  "hide",
]

export class Textcomplete extends EventEmitter {
  private readonly completer: Completer
  private readonly dropdown: Dropdown
  private isQueryInFlight = false
  private nextPendingQuery: string | null = null

  constructor(
    private readonly editor: Editor,
    strategies: StrategyProps[],
    option?: TextcompleteOption
  ) {
    super()
    this.completer = new Completer(strategies)
    this.dropdown = Dropdown.create(option?.dropdown || {})
    this.startListening()
  }

  destroy(destroyEditor = true): this {
    this.completer.destroy()
    this.dropdown.destroy()
    if (destroyEditor) this.editor.destroy()
    this.stopListening()
    return this
  }

  isShown(): boolean {
    return this.dropdown.isShown()
  }

  hide(): this {
    this.dropdown.hide()
    return this
  }

  trigger(beforeCursor: string): this {
    if (this.isQueryInFlight) {
      this.nextPendingQuery = beforeCursor
    } else {
      this.isQueryInFlight = true
      this.nextPendingQuery = null
      this.completer.run(beforeCursor)
    }
    return this
  }

  private handleHit = ({
    searchResults,
  }: {
    searchResults: SearchResult<unknown>[]
  }): void => {
    if (searchResults.length) {
      this.dropdown.render(searchResults, this.editor.getCursorOffset())
    } else {
      this.dropdown.hide()
    }
    this.isQueryInFlight = false
    if (this.nextPendingQuery !== null) this.trigger(this.nextPendingQuery)
  }

  private handleMove = (e: CustomEvent): void => {
    e.detail.code === "UP" ? this.dropdown.up(e) : this.dropdown.down(e)
  }

  private handleEnter = (e: CustomEvent): void => {
    const activeItem = this.dropdown.getActiveItem()
    if (activeItem) {
      this.dropdown.select(activeItem)
      e.preventDefault()
    } else {
      this.dropdown.hide()
    }
  }

  private handleEsc = (e: CustomEvent): void => {
    if (this.dropdown.isShown()) {
      this.dropdown.hide()
      e.preventDefault()
    }
  }

  private handleChange = (e: CustomEvent): void => {
    if (e.detail.beforeCursor != null) {
      this.trigger(e.detail.beforeCursor)
    } else {
      this.dropdown.hide()
    }
  }

  private handleSelect = (selectEvent: CustomEvent): void => {
    this.emit("select", selectEvent)
    if (!selectEvent.defaultPrevented) {
      this.editor.applySearchResult(selectEvent.detail.searchResult)
    }
  }

  private handleResize = (): void => {
    if (this.dropdown.isShown()) {
      this.dropdown.setOffset(this.editor.getCursorOffset())
    }
  }

  private startListening() {
    this.editor
      .on("move", this.handleMove)
      .on("enter", this.handleEnter)
      .on("esc", this.handleEsc)
      .on("change", this.handleChange)
    this.dropdown.on("select", this.handleSelect)
    for (const eventName of PASSTHOUGH_EVENT_NAMES) {
      this.dropdown.on(eventName, (e) => this.emit(eventName, e))
    }
    this.completer.on("hit", this.handleHit)
    this.dropdown.el.ownerDocument.defaultView?.addEventListener(
      "resize",
      this.handleResize
    )
  }

  private stopListening() {
    this.dropdown.el.ownerDocument.defaultView?.removeEventListener(
      "resize",
      this.handleResize
    )
    this.completer.removeAllListeners()
    this.dropdown.removeAllListeners()
    this.editor
      .removeListener("move", this.handleMove)
      .removeListener("enter", this.handleEnter)
      .removeListener("esc", this.handleEsc)
      .removeListener("change", this.handleChange)
  }
}
